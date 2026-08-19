import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
import app.main as main_module
from app.main import app, User, Listing

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_test_data():
    db = main_module.SessionLocal()
    try:
        adv1 = User(phone="01088888888", name="Bed Test Adv", account_type="broker", is_verified=True, auth_token="token_bed_test")
        db.add(adv1)
        db.commit()
        db.refresh(adv1)

        listing1 = Listing(
            title="Bed Test Listing",
            governorate="القاهرة",
            city="مدينة نصر",
            neighborhood="الحي السابع",
            address="Street 1",
            gender="male",
            available_beds=2,
            room_configurations='[{"room_type": "single", "price_per_person": 1000, "count": 2, "available_beds": 2}]',
            advertiser_id=adv1.id,
            status="active"
        )
        db.add(listing1)
        db.commit()
        db.refresh(listing1)

        yield {
            "adv1": adv1,
            "listing1": listing1
        }
    finally:
        db.close()

def test_update_listing_beds_increment_and_decrement(setup_test_data):
    data = setup_test_data
    adv1 = data["adv1"]
    listing1 = data["listing1"]

    # Increment beds to 5
    res = client.post(
        f"/listings/{listing1.id}/beds",
        headers={"Authorization": f"Bearer {adv1.auth_token}"},
        json={"config_index": 0, "available_beds": 5}
    )
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["available_beds"] == 5
    assert res_data["status"] == "active"

    # Decrement beds to 0 (verify status remains active as per Phase 4 rules)
    res2 = client.post(
        f"/listings/{listing1.id}/beds",
        headers={"Authorization": f"Bearer {adv1.auth_token}"},
        json={"config_index": 0, "available_beds": 0}
    )
    assert res2.status_code == 200
    res_data2 = res2.json()
    assert res_data2["available_beds"] == 0
    assert res_data2["status"] == "active"
