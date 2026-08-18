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
