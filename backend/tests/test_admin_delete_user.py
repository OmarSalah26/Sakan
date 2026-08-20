import sys
from pathlib import Path
import random

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.main as main_module
from app.main import app, User, Listing, Rating, Complaint, Bookmark, AdvertiserMessage, PhoneBlocklist, OTPVerification

client = TestClient(app)


def make_phone():
    return f"0199{random.randint(1000000, 9999999)}"


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


def test_non_admin_cannot_delete_user():
    student = register_and_verify(make_phone(), 'Student 1', 'student')
    owner = register_and_verify(make_phone(), 'Owner 1', 'owner')

    # Student attempts to delete owner -> 403 Forbidden
    del_res = client.delete(f"/admin/users/{owner['id']}", headers={'x-user-id': str(student['id'])})
    assert del_res.status_code == 403

    # Unauthenticated attempt -> 403 / 401
    del_res_unauth = client.delete(f"/admin/users/{owner['id']}")
    assert del_res_unauth.status_code in [401, 403]


def test_admin_cannot_delete_admin():
    admin = register_and_verify(make_phone(), 'Admin Super', 'admin')
    headers = {'x-user-id': str(admin['id'])}
    del_res = client.delete(f"/admin/users/{admin['id']}", headers=headers)
    assert del_res.status_code == 400
    assert "مسؤول" in del_res.json()["detail"]


def test_admin_cannot_delete_student_account():
    admin = register_and_verify(make_phone(), 'Admin Super 2', 'admin')
    student = register_and_verify(make_phone(), 'Student Test', 'student')
    headers = {'x-user-id': str(admin['id'])}

    del_res = client.delete(f"/admin/users/{student['id']}", headers=headers)
    assert del_res.status_code == 400
    assert "الملاك والوسطاء" in del_res.json()["detail"]


def test_permanent_cascade_delete_owner_account():
    # 1. Register Admin
    admin = register_and_verify(make_phone(), 'Admin Super 3', 'admin')
    admin_headers = {'x-user-id': str(admin['id'])}

    # 2. Register Owner account
    owner_phone = make_phone()
    owner = register_and_verify(owner_phone, 'Owner Cascade Test', 'owner')
    owner_id = owner['id']

    # 3. Register Student account
    student = register_and_verify(make_phone(), 'Student Interactor', 'student')
    student_id = student['id']

    # 4. Create listing for owner with 5 images
    listing_res = client.post('/listings', json={
        'title': 'Owner Unit For Deletion',
        'governorate': 'أسيوط',
        'city': 'أسيوط',
        'neighborhood': 'شارع الجامعة',
        'address': 'شارع 15',
        'gender': 'male',
        'available_beds': 2,
        'room_configurations': [{
            'room_type': 'single',
            'price_per_person': 1500,
            'commission': 0,
            'count': 1
        }],
        'photo_urls': [
            'https://res.cloudinary.com/dummy/image/upload/v1234/sakan/listings/listing1.jpg',
            'https://res.cloudinary.com/dummy/image/upload/v1234/sakan/listings/listing2.jpg',
            'https://res.cloudinary.com/dummy/image/upload/v1234/sakan/listings/listing3.jpg',
            'https://res.cloudinary.com/dummy/image/upload/v1234/sakan/listings/listing4.jpg',
            'https://res.cloudinary.com/dummy/image/upload/v1234/sakan/listings/listing5.jpg'
        ],
        'video_urls': ['https://res.cloudinary.com/dummy/video/upload/v1234/sakan/listings/video1.mp4'],
        'advertiser_id': owner_id,
        'contact_phone': owner_phone
    })
    assert listing_res.status_code == 200
    listing_id = listing_res.json()['id']

    # 5. Create Bookmark, Rating, Complaint, Message, PhoneBlocklist, OTP
    db = main_module.SessionLocal()
    try:
        bm = Bookmark(user_id=student_id, listing_id=listing_id)
        rt = Rating(student_id=student_id, listing_id=listing_id, star_count=5, review_text="Great place")
        cp = Complaint(student_id=student_id, listing_id=listing_id, advertiser_id=owner_id, violation_type="other", description="Test complaint")
        msg = AdvertiserMessage(recipient_id=owner_id, sender_id=admin['id'], title="Notice", body="Welcome")
        db.add_all([bm, rt, cp, msg])
        db.merge(PhoneBlocklist(phone=owner_phone))
        db.merge(OTPVerification(phone=owner_phone, otp_code="999999", name="Test", account_type="owner"))
        db.commit()
    finally:
        db.close()

    # 6. Verify records exist before deletion
    db = main_module.SessionLocal()
    try:
        assert db.query(User).filter(User.id == owner_id).first() is not None
        assert db.query(Listing).filter(Listing.id == listing_id).first() is not None
        assert db.query(Bookmark).filter(Bookmark.listing_id == listing_id).first() is not None
        assert db.query(Rating).filter(Rating.listing_id == listing_id).first() is not None
        assert db.query(Complaint).filter(Complaint.listing_id == listing_id).first() is not None
        assert db.query(AdvertiserMessage).filter(AdvertiserMessage.recipient_id == owner_id).first() is not None
        assert db.query(PhoneBlocklist).filter(PhoneBlocklist.phone == owner_phone).first() is not None
        assert db.query(OTPVerification).filter(OTPVerification.phone == owner_phone).first() is not None
    finally:
        db.close()

    # 7. Admin deletes the Owner account
    del_res = client.delete(f"/admin/users/{owner_id}", headers=admin_headers)
    assert del_res.status_code == 200
    assert del_res.json() == {"id": owner_id, "phone": owner_phone, "status": "deleted"}

    # 8. Verify zero orphaned rows remain in the database
    db = main_module.SessionLocal()
    try:
        assert db.query(User).filter(User.id == owner_id).first() is None
        assert db.query(Listing).filter(Listing.id == listing_id).first() is None
        assert db.query(Bookmark).filter(Bookmark.listing_id == listing_id).first() is None
        assert db.query(Rating).filter(Rating.listing_id == listing_id).first() is None
        assert db.query(Complaint).filter(Complaint.listing_id == listing_id).first() is None
        assert db.query(AdvertiserMessage).filter(AdvertiserMessage.recipient_id == owner_id).first() is None
        assert db.query(PhoneBlocklist).filter(PhoneBlocklist.phone == owner_phone).first() is None
        assert db.query(OTPVerification).filter(OTPVerification.phone == owner_phone).first() is None
    finally:
        db.close()

    # 9. Re-register with the exact same phone number -> Should register cleanly as a brand-new user
    re_user = register_and_verify(owner_phone, 'Brand New Owner', 'owner')
    assert re_user['phone'] == owner_phone
    assert re_user['name'] == 'Brand New Owner'
    assert re_user['id'] != owner_id  # New database ID assigned
