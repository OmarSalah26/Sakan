import pytest
import json
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app, Listing, User

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_test_users():
    from app.main import SessionLocal
    db = SessionLocal()
    try:
        broker = db.query(User).filter(User.phone == "01099990001").first()
        if not broker:
            broker = User(
                name="وسيط تجريبي",
                phone="01099990001",
                account_type="broker",
                is_verified=True,
                verified_by_sakan=True
            )
            db.add(broker)

        owner = db.query(User).filter(User.phone == "01099990002").first()
        if not owner:
            owner = User(
                name="مالك تجريبي",
                phone="01099990002",
                account_type="owner",
                is_verified=True,
                verified_by_sakan=True
            )
            db.add(owner)

        admin = db.query(User).filter(User.phone == "01099990003").first()
        if not admin:
            admin = User(
                name="مسؤول تجريبي",
                phone="01099990003",
                account_type="admin",
                is_verified=True,
                verified_by_sakan=True
            )
            db.add(admin)

        db.commit()
    finally:
        db.close()


def test_new_listing_defaults_show_total_price_false():
    from app.main import SessionLocal
    db = SessionLocal()
    owner = db.query(User).filter(User.phone == "01099990002").first()
    db.close()

    payload = {
        "title": "شقة اختبارية افتراضية",
        "governorate": "أسيوط",
        "city": "أسيوط",
        "neighborhood": "حي الجامعة",
        "address": "شارع الجمهورية",
        "gender": "male",
        "available_beds": 2,
        "advertiser_id": owner.id,
        "photo_urls": [f"https://example.com/p{i}.jpg" for i in range(5)],
        "room_configurations": [
            {"room_type": "double", "price_per_person": 1200, "count": 1}
        ]
    }

    res = client.post("/listings", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["show_total_price"] is False

    db = SessionLocal()
    db_item = db.query(Listing).filter(Listing.id == data["id"]).first()
    assert db_item.show_total_price is False or db_item.show_total_price == 0
    db.close()


def test_create_listing_with_show_total_price_true():
    from app.main import SessionLocal
    db = SessionLocal()
    broker = db.query(User).filter(User.phone == "01099990001").first()
    db.close()

    payload = {
        "title": "شقة بالكامل مع إظهار السعر الإجمالي",
        "governorate": "دمياط",
        "city": "دمياط الجديدة",
        "neighborhood": "الحي الثاني",
        "address": "شارع الكليات",
        "gender": "female",
        "available_beds": 3,
        "advertiser_id": broker.id,
        "photo_urls": [f"https://example.com/p{i}.jpg" for i in range(5)],
        "show_total_price": True,
        "room_configurations": [
            {"room_type": "single", "price_per_person": 1500, "count": 3}
        ]
    }

    res = client.post("/listings", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["show_total_price"] is True

    db = SessionLocal()
    db_item = db.query(Listing).filter(Listing.id == data["id"]).first()
    assert bool(db_item.show_total_price) is True
    db.close()


def test_update_listing_toggles_show_total_price():
    from app.main import SessionLocal
    db = SessionLocal()
    owner = db.query(User).filter(User.phone == "01099990002").first()
    db.close()

    payload = {
        "title": "شقة للتعديل والتبديل",
        "governorate": "أسيوط",
        "city": "أسيوط",
        "neighborhood": "حي الجامعة",
        "address": "شارع النميس",
        "gender": "male",
        "available_beds": 2,
        "advertiser_id": owner.id,
        "photo_urls": [f"https://example.com/p{i}.jpg" for i in range(5)],
        "show_total_price": False,
        "room_configurations": [
            {"room_type": "double", "price_per_person": 1000, "count": 1}
        ]
    }
    res = client.post("/listings", json=payload)
    assert res.status_code == 200
    listing_id = res.json()["id"]
    assert res.json()["show_total_price"] is False

    update_payload = dict(payload)
    update_payload["show_total_price"] = True
    res_update = client.put(f"/listings/{listing_id}?x_user_id={owner.id}", json=update_payload)
    assert res_update.status_code == 200
    assert res_update.json()["show_total_price"] is True

    update_payload["show_total_price"] = False
    res_update2 = client.put(f"/listings/{listing_id}?x_user_id={owner.id}", json=update_payload)
    assert res_update2.status_code == 200
    assert res_update2.json()["show_total_price"] is False


def test_pricing_mode_isolation():
    from app.main import SessionLocal
    db = SessionLocal()
    broker = db.query(User).filter(User.phone == "01099990001").first()
    db.close()

    payload_a = {
        "title": "شقة تسعير إجمالي بدون إظهار الإجمالي",
        "governorate": "دمياط",
        "city": "دمياط الجديدة",
        "neighborhood": "الحي المركزي",
        "address": "شارع الصعيدي",
        "gender": "male",
        "available_beds": 4,
        "advertiser_id": broker.id,
        "pricing_mode": "total_based",
        "total_price": 5000,
        "show_total_price": False,
        "photo_urls": [f"https://example.com/p{i}.jpg" for i in range(5)],
        "room_configurations": [
            {"room_type": "double", "price_per_person": 1250, "count": 2}
        ]
    }
    res_a = client.post("/listings", json=payload_a)
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert data_a["pricing_mode"] == "total_based"
    assert data_a["total_price"] == 5000
    assert data_a["show_total_price"] is False

    payload_b = {
        "title": "شقة تسعير غرف مع إظهار الإجمالي",
        "governorate": "دمياط",
        "city": "دمياط الجديدة",
        "neighborhood": "الحي المركزي",
        "address": "شارع الصعيدي",
        "gender": "male",
        "available_beds": 4,
        "advertiser_id": broker.id,
        "pricing_mode": "room_based",
        "show_total_price": True,
        "photo_urls": [f"https://example.com/p{i}.jpg" for i in range(5)],
        "room_configurations": [
            {"room_type": "double", "price_per_person": 1250, "count": 2}
        ]
    }
    res_b = client.post("/listings", json=payload_b)
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert data_b["pricing_mode"] == "room_based"
    assert data_b["show_total_price"] is True


def test_schema_backfill_sets_existing_null_to_true():
    from app.main import SessionLocal
    db = SessionLocal()
    try:
        listings = db.query(Listing).all()
        for l in listings:
            assert l.show_total_price is not None
    finally:
        db.close()
