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
        admin = User(phone="01000000099", name="Admin Onboarding", account_type="admin", is_verified=True, auth_token="token_admin_onboarding")
        db.add(admin)

        advertiser = User(phone="01055555555", name="Advertiser Onboarding", account_type="broker", is_verified=True, auth_token="token_adv_onboarding")
        db.add(advertiser)

        db.commit()
        db.refresh(admin)
        db.refresh(advertiser)

        yield {
            "admin": admin,
            "advertiser": advertiser
        }
    finally:
        db.close()

def test_admin_can_generate_user_access_link(setup_test_data):
    data = setup_test_data
    admin = data["admin"]
    advertiser = data["advertiser"]

    res = client.post(f"/admin/users/{advertiser.id}/generate-access-link", headers={"Authorization": f"Bearer {admin.auth_token}"})
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["status"] == "success"
    assert res_data["contact_phone"] == "01055555555"
    assert "account_url" in res_data
    assert "login?phone=01055555555" in res_data["account_url"]
    assert "generated_password" in res_data
    assert "whatsapp_message" in res_data

def test_non_admin_cannot_generate_user_access_link(setup_test_data):
    data = setup_test_data
    advertiser = data["advertiser"]

    res = client.post(f"/admin/users/{advertiser.id}/generate-access-link", headers={"Authorization": f"Bearer {advertiser.auth_token}"})
    assert res.status_code == 403

def test_access_link_does_not_grant_editing_without_authentication(setup_test_data):
    data = setup_test_data
    advertiser = data["advertiser"]

    # Direct request to advertiser's listings without Bearer auth token must return 401
    res = client.get(f"/listings/user/{advertiser.id}")
    assert res.status_code == 401
