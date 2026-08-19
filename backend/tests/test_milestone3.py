import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app

client = TestClient(app)


def register_and_verify(phone, name, account_type):
    register_response = client.post('/auth/register', json={
        'phone': phone,
        'name': name,
        'account_type': account_type,
    })
    otp = register_response.json()['otp_code']
    verify_response = client.post('/auth/verify', json={
        'phone': phone,
        'otp_code': otp,
    })
    return verify_response.json()


def test_admin_can_view_and_update_complaints():
    admin = register_and_verify('201000000099', 'Admin User', 'admin')
    headers = {'x-user-id': str(admin['id'])}
    advertiser = register_and_verify('201000000020', 'Advertiser', 'owner')
    listing_response = client.post('/listings', json={
        'title': 'Test Listing',
        'governorate': 'Cairo',
        'city': 'Nasr City',
        'neighborhood': 'Maadi',
        'address': '1 Example',
        'gender': 'female',
        'available_beds': 1,
        'price_per_person': 2000,
        'room_type': 'single',
        'description': 'Nice place',
        'amenities': ['wifi'],
        'photo_urls': ['/img1.jpg', '/img2.jpg', '/img3.jpg', '/img4.jpg', '/img5.jpg'],
        'advertiser_id': advertiser['id'],
    })
    complaint_response = client.post('/complaints', json={
        'listing_id': listing_response.json()['id'],
        'student_id': 1,
        'violation_type': 'السعر المطلوب أعلى من المعلن',
        'description': 'Misleading price',
    })

    complaints = client.get('/admin/complaints', headers=headers)
    assert complaints.status_code == 200
    assert len(complaints.json()) >= 1

    action_response = client.post(f"/admin/complaints/{complaint_response.json()['id']}/warn", headers=headers)
    assert action_response.status_code == 200
    assert action_response.json()['status'] == 'warned'
