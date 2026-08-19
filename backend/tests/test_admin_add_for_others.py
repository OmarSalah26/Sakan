import sys
from pathlib import Path
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app

client = TestClient(app)


def register_and_verify(phone, name, account_type):
    reg = client.post('/auth/register', json={
        'phone': phone,
        'name': name,
        'account_type': account_type,
    })
    assert reg.status_code == 200
    otp = reg.json()['otp_code']
    ver = client.post('/auth/verify', json={
        'phone': phone,
        'otp_code': otp,
    })
    assert ver.status_code == 200
    return ver.json()


def test_admin_create_advertiser_flow():
    # 1. Register admin user
    admin_data = register_and_verify('01000998877', 'Admin User', 'admin')
    admin_id = admin_data['id']
    admin_token = admin_data.get('auth_token')

    headers = {
        'x-user-id': str(admin_id),
        'Authorization': f"Bearer {admin_token}"
    }

    # 2. Test non-admin rejection
    non_admin_res = client.post('/admin/create-advertiser?x_user_id=999999', json={
        'name': 'Hacker',
        'account_type': 'owner',
        'phone': '01999999999'
    })
    assert non_admin_res.status_code == 403

    # 3. Create new advertiser account for "Jack Owner"
    jack_phone = "01098765432"
    res1 = client.post(f'/admin/create-advertiser?x_user_id={admin_id}', json={
        'name': 'Jack Owner',
        'account_type': 'owner',
        'phone': jack_phone
    }, headers=headers)

    assert res1.status_code == 200
    data1 = res1.json()
    assert data1['status'] == 'created'
    assert data1['is_new_account'] is True
    assert data1['temp_password'] == 'sakan432'
    assert data1['must_change_password'] is True
    jack_id = data1['user_id']

    # 4. Attempt to create again with same phone (existing user test)
    res2 = client.post(f'/admin/create-advertiser?x_user_id={admin_id}', json={
        'name': 'Jack Owner Duplicate Attempt',
        'account_type': 'owner',
        'phone': jack_phone
    }, headers=headers)

    assert res2.status_code == 200
    data2 = res2.json()
    assert data2['status'] == 'existing'
    assert data2['is_new_account'] is False
    assert data2['user_id'] == jack_id
    assert data2['temp_password'] is None

    # 5. Create listing for Jack under Jack's user_id
    listing_res = client.post('/listings', json={
        'title': 'Jack Property in Dokki',
        'governorate': 'الجيزة',
        'city': 'الدقي',
        'neighborhood': 'ميدان لبنان',
        'address': '5 Sharia El Nile',
        'gender': 'male',
        'available_beds': 2,
        'price_per_person': 2500,
        'room_type': 'double',
        'description': 'Nice furnished room for students',
        'amenities': ['wifi', 'ac', 'elevator'],
        'photo_urls': ['/img1.jpg', '/img2.jpg', '/img3.jpg', '/img4.jpg', '/img5.jpg'],
        'advertiser_id': jack_id,
        'contact_phone': jack_phone
    })
    assert listing_res.status_code == 200
    listing_data = listing_res.json()
    assert listing_data['advertiser_id'] == jack_id

    # 6. Verify Jack can log in with temp password
    jack_login = client.post('/auth/login-password', json={
        'phone': jack_phone,
        'password': 'sakan432'
    })
    assert jack_login.status_code == 200
    jack_user = jack_login.json()
    assert jack_user['must_change_password'] is True

    # 7. Jack updates password to new permanent password
    change_res = client.post('/auth/change-password', json={
        'user_id': jack_id,
        'new_password': 'newsecretpassword123'
    })
    assert change_res.status_code == 200
    assert change_res.json()['must_change_password'] is False

    # 8. Temp password no longer works
    old_login = client.post('/auth/login-password', json={
        'phone': jack_phone,
        'password': 'sakan432'
    })
    assert old_login.status_code == 401

    # 9. New password works
    new_login = client.post('/auth/login-password', json={
        'phone': jack_phone,
        'password': 'newsecretpassword123'
    })
    assert new_login.status_code == 200
    assert new_login.json()['must_change_password'] is False


def test_owner_broker_commission_matrix():
    # 1. Setup accounts: Owner, Broker, Admin
    owner_user = register_and_verify('01111111111', 'Normal Owner', 'owner')
    broker_user = register_and_verify('01222222222', 'Normal Broker', 'broker')
    admin_user = register_and_verify('01333333333', 'Admin Tester', 'admin')

    # MATRIX CASE 1: Normal Creation + Owner
    # Attempting to send commission=500 on Owner listing creation
    owner_listing_res = client.post('/listings', json={
        'title': 'Owner Property Normal',
        'governorate': 'أسيوط',
        'city': 'أسيوط',
        'neighborhood': 'جامعة أسيوط',
        'address': 'شارع الجامعة',
        'gender': 'female',
        'available_beds': 2,
        'room_configurations': [{
            'room_type': 'single',
            'price_per_person': 1000,
            'commission': 500,
            'commission_pct': 50,
            'count': 1
        }],
        'photo_urls': ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg', '/5.jpg'],
        'advertiser_id': owner_user['id'],
        'contact_phone': '01111111111'
    })
    assert owner_listing_res.status_code == 200
    owner_l_data = owner_listing_res.json()
    assert owner_l_data['advertiser_type'] == 'owner'
    # Commission MUST be stripped to 0 / fixed
    cfg0 = owner_l_data['room_configurations'][0]
    assert cfg0['commission'] == 0
    assert cfg0['commission_pct'] == 0
    assert cfg0['commission_min'] is None
    assert cfg0['commission_max'] is None

    # MATRIX CASE 2: Normal Creation + Broker
    broker_listing_res = client.post('/listings', json={
        'title': 'Broker Property Normal',
        'governorate': 'أسيوط',
        'city': 'أسيوط',
        'neighborhood': 'جامعة أسيوط',
        'address': 'شارع الجامعة',
        'gender': 'male',
        'available_beds': 2,
        'room_configurations': [{
            'room_type': 'single',
            'price_per_person': 1000,
            'commission': 500,
            'commission_pct': 50,
            'count': 1
        }],
        'photo_urls': ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg', '/5.jpg'],
        'advertiser_id': broker_user['id'],
        'contact_phone': '01222222222'
    })
    assert broker_listing_res.status_code == 200
    broker_l_data = broker_listing_res.json()
    assert broker_l_data['advertiser_type'] == 'broker'
    b_cfg0 = broker_l_data['room_configurations'][0]
    assert b_cfg0['commission'] == 500

    # MATRIX CASE 3: Normal Editing + Owner
    # Attempting to add commission during update of Owner listing
    edit_owner_res = client.put(
        f"/listings/{owner_l_data['id']}?x_user_id={owner_user['id']}",
        json={
            'title': 'Owner Property Normal Updated',
            'governorate': 'أسيوط',
            'city': 'أسيوط',
            'neighborhood': 'جامعة أسيوط',
            'gender': 'female',
            'available_beds': 2,
            'room_configurations': [{
                'room_type': 'single',
                'price_per_person': 1200,
                'commission': 600,
                'commission_pct': 50,
                'count': 1
            }],
            'photo_urls': ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg', '/5.jpg'],
            'advertiser_id': owner_user['id'],
            'contact_phone': '01111111111'
        }
    )
    assert edit_owner_res.status_code == 200
    edited_owner_data = edit_owner_res.json()
    assert edited_owner_data['advertiser_type'] == 'owner'
    eo_cfg0 = edited_owner_data['room_configurations'][0]
    assert eo_cfg0['commission'] == 0
    assert eo_cfg0['commission_pct'] == 0

    # MATRIX CASE 4: Normal Editing + Broker
    edit_broker_res = client.put(
        f"/listings/{broker_l_data['id']}?x_user_id={broker_user['id']}",
        json={
            'title': 'Broker Property Normal Updated',
            'governorate': 'أسيوط',
            'city': 'أسيوط',
            'neighborhood': 'جامعة أسيوط',
            'gender': 'male',
            'available_beds': 2,
            'room_configurations': [{
                'room_type': 'single',
                'price_per_person': 1200,
                'commission': 600,
                'commission_pct': 50,
                'count': 1
            }],
            'photo_urls': ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg', '/5.jpg'],
            'advertiser_id': broker_user['id'],
            'contact_phone': '01222222222'
        }
    )
    assert edit_broker_res.status_code == 200
    edited_broker_data = edit_broker_res.json()
    assert edited_broker_data['advertiser_type'] == 'broker'
    eb_cfg0 = edited_broker_data['room_configurations'][0]
    assert eb_cfg0['commission'] == 600

    # MATRIX CASE 5: حطهولي + Owner
    # Admin creates Owner user via add-for-others endpoint
    admin_headers = {'x-user-id': str(admin_user['id'])}
    hatolli_owner = client.post(f"/admin/create-advertiser?x_user_id={admin_user['id']}", json={
        'name': 'Hatolli Owner Account',
        'account_type': 'owner',
        'phone': '01444444444'
    }, headers=admin_headers).json()

    ho_listing_res = client.post('/listings', json={
        'title': 'Hatolli Owner Property',
        'governorate': 'أسيوط',
        'city': 'أسيوط',
        'neighborhood': 'حي الجامعة',
        'gender': 'female',
        'available_beds': 1,
        'room_configurations': [{
            'room_type': 'single',
            'price_per_person': 1500,
            'commission': 750,
            'commission_pct': 50,
            'count': 1
        }],
        'photo_urls': ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg', '/5.jpg'],
        'advertiser_id': hatolli_owner['user_id'],
        'contact_phone': '01444444444'
    })
    assert ho_listing_res.status_code == 200
    ho_l_data = ho_listing_res.json()
    assert ho_l_data['advertiser_id'] == hatolli_owner['user_id']
    assert ho_l_data['advertiser_type'] == 'owner'
    ho_cfg0 = ho_l_data['room_configurations'][0]
    assert ho_cfg0['commission'] == 0
    assert ho_cfg0['commission_pct'] == 0

    # Edit Hatolli Owner listing as Admin
    edit_ho_res = client.put(
        f"/listings/{ho_l_data['id']}?x_user_id={admin_user['id']}",
        json={
            'title': 'Hatolli Owner Property Edit',
            'governorate': 'أسيوط',
            'city': 'أسيوط',
            'neighborhood': 'حي الجامعة',
            'gender': 'female',
            'available_beds': 1,
            'room_configurations': [{
                'room_type': 'single',
                'price_per_person': 1600,
                'commission': 800,
                'count': 1
            }],
            'photo_urls': ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg', '/5.jpg'],
            'advertiser_id': hatolli_owner['user_id'],
            'contact_phone': '01444444444'
        }
    )
    assert edit_ho_res.status_code == 200
    edited_ho_data = edit_ho_res.json()
    assert edited_ho_data['advertiser_type'] == 'owner'
    assert edited_ho_data['room_configurations'][0]['commission'] == 0

    # MATRIX CASE 6: حطهولي + Broker
    hatolli_broker = client.post(f"/admin/create-advertiser?x_user_id={admin_user['id']}", json={
        'name': 'Hatolli Broker Account',
        'account_type': 'broker',
        'phone': '01555555555'
    }, headers=admin_headers).json()

    hb_listing_res = client.post('/listings', json={
        'title': 'Hatolli Broker Property',
        'governorate': 'أسيوط',
        'city': 'أسيوط',
        'neighborhood': 'حي الجامعة',
        'gender': 'male',
        'available_beds': 1,
        'room_configurations': [{
            'room_type': 'single',
            'price_per_person': 1500,
            'commission': 750,
            'commission_pct': 50,
            'count': 1
        }],
        'photo_urls': ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg', '/5.jpg'],
        'advertiser_id': hatolli_broker['user_id'],
        'contact_phone': '01555555555'
    })
    assert hb_listing_res.status_code == 200
    hb_l_data = hb_listing_res.json()
    assert hb_l_data['advertiser_id'] == hatolli_broker['user_id']
    assert hb_l_data['advertiser_type'] == 'broker'
    hb_cfg0 = hb_l_data['room_configurations'][0]
    assert hb_cfg0['commission'] == 750
    assert hb_cfg0['commission_pct'] == 50


def test_admin_commission_status_correction_for_existing_listings():
    # 1. Register Owner user & Admin user
    owner_user = register_and_verify('01666666666', 'Historical Owner', 'owner')
    admin_user = register_and_verify('01777777777', 'Admin Corrector', 'admin')

    # 2. Simulate listing belonging to Owner that has 0 commission
    listing_res = client.post('/listings', json={
        'title': 'Owner Historical Property',
        'governorate': 'أسيوط',
        'city': 'أسيوط',
        'neighborhood': 'شارع الجامعة',
        'gender': 'female',
        'available_beds': 1,
        'room_configurations': [{
            'room_type': 'single',
            'price_per_person': 1500,
            'commission': 0,
            'commission_pct': 0,
            'count': 1
        }],
        'photo_urls': ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg', '/5.jpg'],
        'advertiser_id': owner_user['id'],
        'contact_phone': '01666666666'
    })
    assert listing_res.status_code == 200
    listing = listing_res.json()
    assert listing['advertiser_id'] == owner_user['id']
    assert listing['advertiser_type'] == 'owner'

    # 3. Admin opens and edits listing, ensuring 0 commission is retained
    admin_edit = client.put(
        f"/listings/{listing['id']}?x_user_id={admin_user['id']}",
        json={
            'title': 'Owner Historical Property Corrected',
            'governorate': 'أسيوط',
            'city': 'أسيوط',
            'neighborhood': 'شارع الجامعة',
            'gender': 'female',
            'available_beds': 1,
            'room_configurations': [{
                'room_type': 'single',
                'price_per_person': 1600,
                'commission': 0,
                'commission_pct': 0,
                'count': 1
            }],
            'photo_urls': ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg', '/5.jpg'],
            'advertiser_id': owner_user['id'],
            'contact_phone': '01666666666'
        }
    )
    assert admin_edit.status_code == 200
    updated = admin_edit.json()
    assert updated['advertiser_id'] == owner_user['id']
    assert updated['advertiser_type'] == 'owner'
    assert updated['room_configurations'][0]['commission'] == 0


