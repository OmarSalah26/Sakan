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
    assert register_response.status_code == 200
    otp = register_response.json()['otp_code']
    verify_response = client.post('/auth/verify', json={
        'phone': phone,
        'otp_code': otp,
    })
    assert verify_response.status_code == 200
    return verify_response.json()


def test_health_check():
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}


def test_register_user():
    data = register_and_verify('201000000001', 'Test User', 'student')
    assert data['phone'] == '201000000001'
    assert data['account_type'] == 'student'


def test_create_listing():
    advertiser = register_and_verify('201000000002', 'Advertiser', 'owner')
    advertiser_id = advertiser['id']

    response = client.post('/listings', json={
        'title': 'Sunny Room',
        'governorate': 'Cairo',
        'city': 'Nasr City',
        'neighborhood': 'Maadi',
        'address': '123 Test Street',
        'gender': 'female',
        'available_beds': 2,
        'price_per_person': 3000,
        'room_type': 'single',
        'description': 'Great place',
        'amenities': ['wifi', 'ac'],
        'photo_urls': ['/img1.jpg', '/img2.jpg', '/img3.jpg', '/img4.jpg', '/img5.jpg'],
        'advertiser_id': advertiser_id,
    })
    assert response.status_code == 200
    data = response.json()
    assert data['title'] == 'Sunny Room'
    assert data['advertiser_id'] == advertiser_id

    listing_id = data['id']
    og_res = client.get(f'/listings/{listing_id}/share')
    assert og_res.status_code == 200
    assert 'og:title' in og_res.text
    assert 'og:description' in og_res.text
    assert 'Sunny Room' in og_res.text
    assert 'twitter:card' in og_res.text

