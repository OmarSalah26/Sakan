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
        adv1 = User(phone="01011111111", name="Advertiser One", account_type="broker", is_verified=True, auth_token="token_adv1")
        db.add(adv1)
        db.commit()
        db.refresh(adv1)

        adv2 = User(phone="01022222222", name="Advertiser Two", account_type="owner", is_verified=True, auth_token="token_adv2")
        db.add(adv2)
        db.commit()
        db.refresh(adv2)

        listing1 = Listing(
            title="Adv1 Property",
            governorate="القاهرة",
            city="مدينة نصر",
            neighborhood="الحي السابع",
            address="Street 1",
            gender="male",
            available_beds=2,
            advertiser_id=adv1.id,
            status="active"
        )
        db.add(listing1)
        db.commit()
        db.refresh(listing1)

        yield {
            "adv1": adv1,
            "adv2": adv2,
            "listing1": listing1
        }
    finally:
        db.close()

def test_advertiser_can_delete_own_listing(setup_test_data):
    data = setup_test_data
    adv1 = data["adv1"]
    listing1 = data["listing1"]

    res = client.delete(f"/listings/{listing1.id}", headers={"Authorization": f"Bearer {adv1.auth_token}"})
    assert res.status_code == 200
    assert res.json()["status"] == "deleted"

def test_advertiser_cannot_delete_other_advertiser_listing(setup_test_data):
    data = setup_test_data
    adv2 = data["adv2"]
    listing1 = data["listing1"]

    res = client.delete(f"/listings/{listing1.id}", headers={"Authorization": f"Bearer {adv2.auth_token}"})
    assert res.status_code == 403

def test_unauthenticated_cannot_delete_listing(setup_test_data):
    data = setup_test_data
    listing1 = data["listing1"]

    res = client.delete(f"/listings/{listing1.id}")
    assert res.status_code == 401
