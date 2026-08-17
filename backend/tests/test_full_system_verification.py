import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
import app.main as main_module
from app.main import app, User, Listing, Governorate

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_system_test_data():
    db = main_module.SessionLocal()
    try:
        # Admin
        admin = User(phone="01099999999", name="System Admin", account_type="admin", is_verified=True, auth_token="token_sys_admin")
        db.add(admin)

        # Advertiser A
        advA = User(phone="01011112222", name="Advertiser Alpha", account_type="broker", is_verified=True, auth_token="token_sys_advA")
        db.add(advA)

        # Advertiser B
        advB = User(phone="01033334444", name="Advertiser Beta", account_type="owner", is_verified=True, auth_token="token_sys_advB")
        db.add(advB)

        db.commit()
        db.refresh(admin)
        db.refresh(advA)
        db.refresh(advB)

        # Listings for Advertiser A
        listingA1 = Listing(
            title="Alpha Property 1",
            governorate="القاهرة",
            city="مدينة نصر",
            neighborhood="الحي السابع",
            address="Street 1",
            gender="male",
            available_beds=3,
            advertiser_id=advA.id,
            status="active"
        )
        listingA2 = Listing(
            title="Alpha Property 2",
            governorate="القاهرة",
            city="مصر الجديدة",
            neighborhood="الميرغني",
            address="Street 2",
            gender="female",
            available_beds=2,
            advertiser_id=advA.id,
            status="active"
        )

        # Listing for Advertiser B
        listingB1 = Listing(
            title="Beta Property 1",
            governorate="الجيزة",
            city="الدقي",
            neighborhood="مصدق",
            address="Street 3",
            gender="male",
            available_beds=4,
            advertiser_id=advB.id,
            status="active"
        )

        db.add_all([listingA1, listingA2, listingB1])
        db.commit()
        db.refresh(listingA1)
        db.refresh(listingA2)
        db.refresh(listingB1)

        yield {
            "admin": admin,
            "advA": advA,
            "advB": advB,
            "listingA1": listingA1,
            "listingA2": listingA2,
            "listingB1": listingB1
        }
    finally:
        db.close()

def test_scenario1_advertiser_ownership_and_isolation(setup_system_test_data):
    data = setup_system_test_data
    advA = data["advA"]
    advB = data["advB"]
    listingB1 = data["listingB1"]

    # 1. Advertiser A logs in and fetches own listings -> sees only A's listings
    res = client.get(f"/listings/user/{advA.id}", headers={"Authorization": f"Bearer {advA.auth_token}"})
    assert res.status_code == 200
    user_listings = res.json()
    assert len(user_listings) == 2
    assert all(l["advertiser_id"] == advA.id for l in user_listings)

    # 2. Advertiser A cannot fetch Advertiser B's management listings -> 403
    res_b = client.get(f"/listings/user/{advB.id}", headers={"Authorization": f"Bearer {advA.auth_token}"})
    assert res_b.status_code == 403

    # 3. Advertiser A cannot edit Advertiser B's listing -> 403
    payload = {
        "title": "Hacked Title",
        "governorate": "الجيزة",
        "city": "الدقي",
        "neighborhood": "مصدق",
        "address": "Street 3",
        "gender": "male",
        "available_beds": 10,
        "advertiser_id": advB.id
    }
    res_edit = client.put(f"/listings/{listingB1.id}", json=payload, headers={"Authorization": f"Bearer {advA.auth_token}"})
    assert res_edit.status_code == 403

def test_scenario2_account_onboarding_flow(setup_system_test_data):
    data = setup_system_test_data
    admin = data["admin"]
    advB = data["advB"]

    # 1. Admin generates access link
    res = client.post(f"/admin/users/{advB.id}/generate-access-link?x_user_id={admin.id}", headers={"Authorization": f"Bearer {admin.auth_token}"})
    assert res.status_code == 200
    access_data = res.json()
    assert access_data["status"] == "success"
    assert "login?phone=01033334444" in access_data["account_url"]
    assert "generated_password" in access_data

    # 2. Access link does not grant editing without credentials -> 401
    res_no_auth = client.get(f"/listings/user/{advB.id}")
    assert res_no_auth.status_code == 401

    # 3. Sign in with credentials succeeds
    res_login = client.post("/auth/login-password", json={"phone": advB.phone, "password": access_data["generated_password"]})
    assert res_login.status_code == 200
    assert "auth_token" in res_login.json()

def test_scenario3_editing_and_persistence(setup_system_test_data):
    data = setup_system_test_data
    advA = data["advA"]
    listingA1 = data["listingA1"]
    listingA2 = data["listingA2"]

    # Edit Listing A1
    payload = {
        "title": "Updated Alpha Title 1",
        "governorate": listingA1.governorate,
        "city": listingA1.city,
        "neighborhood": listingA1.neighborhood,
        "address": listingA1.address,
        "gender": listingA1.gender,
        "available_beds": 5,
        "advertiser_id": advA.id
    }
    res = client.put(f"/listings/{listingA1.id}", json=payload, headers={"Authorization": f"Bearer {advA.auth_token}"})
    assert res.status_code == 200
    assert res.json()["title"] == "Updated Alpha Title 1"

    # Verify Listing A2 remains unchanged
    res_a2 = client.get(f"/listings/{listingA2.id}")
    assert res_a2.status_code == 200
    listing_a2_data = res_a2.json().get("listing", res_a2.json())
    assert listing_a2_data["title"] == "Alpha Property 2"

def test_scenario4_public_profile_separation(setup_system_test_data):
    data = setup_system_test_data
    advA = data["advA"]

    # Student opens advertiser public profile -> 200 OK
    res = client.get(f"/users/{advA.id}/profile")
    assert res.status_code == 200
    prof = res.json()
    assert prof["user"]["name"] == "Advertiser Alpha"
    assert "listings" in prof

    # Student trying to access private management endpoint without auth -> 401
    res_mgmt = client.get(f"/listings/user/{advA.id}")
    assert res_mgmt.status_code == 401

def test_scenario5_listing_state_and_deletion(setup_system_test_data):
    data = setup_system_test_data
    advA = data["advA"]
    listingA1 = data["listingA1"]

    # 1. Advertiser marks listing Fully Booked (toggle status)
    res_toggle = client.post(f"/listings/{listingA1.id}/toggle-status", headers={"Authorization": f"Bearer {advA.auth_token}"})
    assert res_toggle.status_code == 200
    assert res_toggle.json()["status"] == "inactive"

    # 2. Hidden from public student search
    res_public = client.get("/listings")
    assert res_public.status_code == 200
    public_ids = [l["id"] for l in res_public.json()]
    assert listingA1.id not in public_ids

    # 3. Remains visible inside advertiser account dashboard
    res_own = client.get(f"/listings/user/{advA.id}", headers={"Authorization": f"Bearer {advA.auth_token}"})
    assert res_own.status_code == 200
    own_ids = [l["id"] for l in res_own.json()]
    assert listingA1.id in own_ids

    # 4. Advertiser marks it Active again
    res_toggle2 = client.post(f"/listings/{listingA1.id}/toggle-status", headers={"Authorization": f"Bearer {advA.auth_token}"})
    assert res_toggle2.status_code == 200
    assert res_toggle2.json()["status"] == "active"

    # 5. Visible again to public student search
    res_public2 = client.get("/listings")
    public_ids2 = [l["id"] for l in res_public2.json()]
    assert listingA1.id in public_ids2

    # 6. Delete remains separate permanent action
    res_del = client.delete(f"/listings/{listingA1.id}", headers={"Authorization": f"Bearer {advA.auth_token}"})
    assert res_del.status_code == 200
    assert res_del.json()["status"] == "deleted"

def test_scenario6_existing_functionality(setup_system_test_data):
    data = setup_system_test_data
    admin = data["admin"]

    # Admin dashboard endpoints work
    res_admin_listings = client.get(f"/admin/listings?x_user_id={admin.id}", headers={"Authorization": f"Bearer {admin.auth_token}"})
    assert res_admin_listings.status_code == 200

    res_admin_users = client.get(f"/admin/users?x_user_id={admin.id}", headers={"Authorization": f"Bearer {admin.auth_token}"})
    assert res_admin_users.status_code == 200


def test_pricing_mode_and_total_price_scenarios(setup_system_test_data):
    data = setup_system_test_data
    advA = data["advA"]

    # Test A: Normal room-based listing (4 beds * 3000 = 12000)
    payload_a = {
        "title": "Pricing Test Listing",
        "governorate": "القاهرة",
        "city": "مدينة نصر",
        "neighborhood": "الحي السابع",
        "gender": "male",
        "available_beds": 4,
        "advertiser_id": advA.id,
        "pricing_mode": "room_based",
        "total_price": 12000,
        "room_configurations": [
            {"room_type": "quadruple", "count": 1, "price_per_person": 3000, "commission": 500}
        ]
    }
    res_a = client.post("/listings", json=payload_a, headers={"Authorization": f"Bearer {advA.auth_token}"})
    assert res_a.status_code == 200
    listing_a = res_a.json()
    assert listing_a["pricing_mode"] == "room_based"
    assert listing_a["totalPrice"] == 12000

    # Test B & C: Manual override to total_based (14000)
    payload_b = dict(payload_a)
    payload_b["pricing_mode"] = "total_based"
    payload_b["total_price"] = 14000
    res_b = client.put(f"/listings/{listing_a['id']}?x_user_id={advA.id}", json=payload_b, headers={"Authorization": f"Bearer {advA.auth_token}"})
    assert res_b.status_code == 200
    listing_b = res_b.json()
    assert listing_b["pricing_mode"] == "total_based"
    assert listing_b["totalPrice"] == 14000

    # Test D: Explicit return to room_based
    payload_d = dict(payload_b)
    payload_d["pricing_mode"] = "room_based"
    payload_d["total_price"] = 12000
    res_d = client.put(f"/listings/{listing_a['id']}?x_user_id={advA.id}", json=payload_d, headers={"Authorization": f"Bearer {advA.auth_token}"})
    assert res_d.status_code == 200
    listing_d = res_d.json()
    assert listing_d["pricing_mode"] == "room_based"
    assert listing_d["totalPrice"] == 12000

    # Test E: Imported total-only listing
    payload_e = {
        "title": "Imported Listing",
        "governorate": "القاهرة",
        "city": "مصر الجديدة",
        "neighborhood": "الميرغني",
        "gender": "female",
        "available_beds": 2,
        "advertiser_id": advA.id,
        "pricing_mode": "total_based",
        "total_price": 15000,
        "room_configurations": []
    }
    res_e = client.post("/listings", json=payload_e, headers={"Authorization": f"Bearer {advA.auth_token}"})
    assert res_e.status_code == 200
    listing_e = res_e.json()
    assert listing_e["pricing_mode"] == "total_based"
    assert listing_e["totalPrice"] == 15000


def test_range_commission_and_min_max_persistence(setup_system_test_data):
    data = setup_system_test_data
    advA = data["advA"]

    # Create listing with range commission (commission_min_pct: 20, commission_max_pct: 60)
    payload = {
        "title": "Variable Commission Test Listing",
        "governorate": "القاهرة",
        "city": "مدينة نصر",
        "neighborhood": "الحي الثامن",
        "gender": "male",
        "available_beds": 2,
        "advertiser_id": advA.id,
        "pricing_mode": "room_based",
        "total_price": 6000,
        "room_configurations": [
            {
                "room_type": "double",
                "count": 1,
                "price_per_person": 3000,
                "commission_type": "range",
                "commission_min_pct": 20,
                "commission_max_pct": 60,
                "commission_min": 20,
                "commission_max": 60
            }
        ]
    }
    res = client.post("/listings", json=payload, headers={"Authorization": f"Bearer {advA.auth_token}"})
    assert res.status_code == 200
    listing = res.json()
    configs = listing.get("room_configurations", [])
    assert len(configs) == 1
    assert configs[0]["commission_type"] == "range"
    assert configs[0]["commission_min"] == 20 or configs[0]["commission_min_pct"] == 20
    assert configs[0]["commission_max"] == 60 or configs[0]["commission_max_pct"] == 60

