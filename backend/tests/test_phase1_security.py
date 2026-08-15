import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
import app.main as main_module
from app.main import app, User, Listing, user_to_user_out

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_test_users_and_listings():
    db = main_module.SessionLocal()
    try:
        # Create Advertiser A
        user_a = User(phone="01011111111", name="Advertiser A", account_type="broker", is_verified=True, auth_token="token_adv_a")
        db.add(user_a)
        
        # Create Advertiser B
        user_b = User(phone="01022222222", name="Advertiser B", account_type="broker", is_verified=True, auth_token="token_adv_b")
        db.add(user_b)
        
        # Create Admin
        admin = User(phone="01000000000", name="Admin User", account_type="admin", is_verified=True, auth_token="token_admin")
        db.add(admin)
        
        db.commit()
        db.refresh(user_a)
        db.refresh(user_b)
        db.refresh(admin)

        # Create Listing for Advertiser B
        listing_b = Listing(
            title="Listing of B",
            governorate="القاهرة",
            city="مدينة نصر",
            neighborhood="المنطقة الأولى",
            address="عنوان B",
            gender="male",
            available_beds=2,
            advertiser_id=user_b.id,
            price_per_person=1000,
            room_type="single"
        )
        db.add(listing_b)
        db.commit()
        db.refresh(listing_b)

        yield {
            "adv_a": user_a,
            "adv_b": user_b,
            "admin": admin,
            "listing_b": listing_b
        }
    finally:
        db.close()

def test_advertiser_cannot_view_other_advertiser_listings(setup_test_users_and_listings):
    data = setup_test_users_and_listings
    adv_a = data["adv_a"]
    adv_b = data["adv_b"]

    # Advertiser A attempts to view Advertiser B's listings -> 403 Forbidden
    res = client.get(f"/listings/user/{adv_b.id}", headers={"Authorization": f"Bearer {adv_a.auth_token}"})
    assert res.status_code == 403

def test_advertiser_can_view_own_listings(setup_test_users_and_listings):
    data = setup_test_users_and_listings
    adv_b = data["adv_b"]

    # Advertiser B views own listings -> 200 OK
    res = client.get(f"/listings/user/{adv_b.id}", headers={"Authorization": f"Bearer {adv_b.auth_token}"})
    assert res.status_code == 200
    assert len(res.json()) >= 1

def test_advertiser_cannot_update_other_advertiser_listing(setup_test_users_and_listings):
    data = setup_test_users_and_listings
    adv_a = data["adv_a"]
    listing_b = data["listing_b"]

    update_payload = {
        "title": "Hacked Title",
        "governorate": "القاهرة",
        "city": "مدينة نصر",
        "neighborhood": "المنطقة الأولى",
        "address": "عنوان B",
        "gender": "male",
        "available_beds": 2,
        "advertiser_id": adv_a.id,
        "price_per_person": 1000
    }
    res = client.put(f"/listings/{listing_b.id}", json=update_payload, headers={"Authorization": f"Bearer {adv_a.auth_token}"})
    assert res.status_code == 403

def test_advertiser_cannot_modify_beds_of_other_advertiser_listing(setup_test_users_and_listings):
    data = setup_test_users_and_listings
    adv_a = data["adv_a"]
    listing_b = data["listing_b"]

    res = client.post(f"/listings/{listing_b.id}/beds", json={"available_beds": 0}, headers={"Authorization": f"Bearer {adv_a.auth_token}"})
    assert res.status_code == 403

def test_advertiser_cannot_deactivate_other_advertiser_listing(setup_test_users_and_listings):
    data = setup_test_users_and_listings
    adv_a = data["adv_a"]
    listing_b = data["listing_b"]

    res = client.post(f"/listings/{listing_b.id}/deactivate", headers={"Authorization": f"Bearer {adv_a.auth_token}"})
    assert res.status_code == 403

def test_unauthenticated_request_is_rejected(setup_test_users_and_listings):
    data = setup_test_users_and_listings
    listing_b = data["listing_b"]
    adv_b = data["adv_b"]

    res1 = client.get(f"/listings/user/{adv_b.id}")
    assert res1.status_code == 401

    res2 = client.post(f"/listings/{listing_b.id}/deactivate")
    assert res2.status_code == 401

def test_admin_can_access_any_listing(setup_test_users_and_listings):
    data = setup_test_users_and_listings
    admin = data["admin"]
    adv_b = data["adv_b"]

    res = client.get(f"/listings/user/{adv_b.id}", headers={"Authorization": f"Bearer {admin.auth_token}"})
    assert res.status_code == 200
