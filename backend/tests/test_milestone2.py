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


def test_submit_advertiser_rating_and_complaint():
    student = register_and_verify('201000000010', 'Student User', 'student')
    advertiser = register_and_verify('201000000011', 'Owner User', 'owner')

    listing_response = client.post('/listings', json={
        'title': 'Study Room',
        'governorate': 'Giza',
        'city': 'Dokki',
        'neighborhood': 'Mohandessin',
        'address': '10 Example',
        'gender': 'female',
        'available_beds': 1,
        'price_per_person': 2500,
        'room_type': 'double',
        'description': 'Good location',
        'amenities': ['wifi'],
        'photo_urls': ['/img1.jpg', '/img2.jpg', '/img3.jpg', '/img4.jpg', '/img5.jpg'],
        'advertiser_id': advertiser['id'],
    })

    rating_response = client.post('/ratings/advertiser', json={
        'listing_id': listing_response.json()['id'],
        'student_id': student['id'],
        'star_count': 5,
        'review_text': 'Great host and fast communication',
    })
    assert rating_response.status_code == 200
    assert rating_response.json()['star_count'] == 5

    complaint_response = client.post('/complaints', json={
        'listing_id': listing_response.json()['id'],
        'student_id': student['id'],
        'violation_type': 'السعر المطلوب أعلى من المعلن',
        'description': 'The listing price was misleading',
    })
    assert complaint_response.status_code == 200
    assert complaint_response.json()['status'] == 'submitted'
