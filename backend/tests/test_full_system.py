"""
============================================================
  SAKAN – Comprehensive Full-System Test Suite
  Covers:
    1. Registration & OTP verification (all 3 roles)
    2. Login OTP flow
    3. Duplicate registration / blocklisted phone rejection
    4. Role-based privilege enforcement (who CAN & CANNOT)
    5. Full DB CRUD for Listings, Ratings, Complaints
    6. Listing filters (price range, room type, gender)
    7. Beds update & republish flows
    8. Admin moderation: warn → auto-ban at 2nd offense
    9. Admin direct ban / unban
   10. Admin listing deactivate
   11. Detailed listing endpoint (advertiser profile, ratings)
============================================================
"""

import sys
from pathlib import Path
import pytest
import app.main as main_module

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from app.main import app, PhoneBlocklist, OTPVerification

# ──────────────────────────────────────────────
#  Test client & DB reset before every test
# ──────────────────────────────────────────────
client = TestClient(app)


# ──────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────
def _register(phone, name="Test", account_type="student"):
    return client.post("/auth/register", json={
        "phone": phone,
        "name": name,
        "account_type": account_type,
    })

def _verify(phone, otp):
    return client.post("/auth/verify", json={"phone": phone, "otp_code": otp})

def _register_and_verify(phone, name="Test", account_type="student"):
    r = _register(phone, name, account_type)
    assert r.status_code == 200, f"register failed: {r.text}"
    otp = r.json()["otp_code"]
    v = _verify(phone, otp)
    assert v.status_code == 200, f"verify failed: {v.text}"
    return v.json()

def _create_listing(advertiser_id, **kwargs):
    payload = {
        "title": "Test Listing",
        "governorate": "القاهرة",
        "city": "مدينة نصر",
        "neighborhood": "المنطقة الأولى",
        "address": "12 شارع التحرير",
        "gender": "female",
        "available_beds": 3,
        "advertiser_id": advertiser_id,
        "price_per_person": 1500,
        "room_type": "single",
        "description": "وحدة رائعة",
        "photo_urls": ["/img1.jpg", "/img2.jpg", "/img3.jpg", "/img4.jpg", "/img5.jpg"],
        "room_configurations": [
            {"room_type": "single", "price_per_person": 1500, "commission": 750}
        ],
    }
    payload.update(kwargs)
    return client.post("/listings", json=payload)


# ══════════════════════════════════════════════
#  1. HEALTH CHECK
# ══════════════════════════════════════════════
class TestHealthCheck:
    def test_health_endpoint_returns_ok(self):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}


# ══════════════════════════════════════════════
#  2. REGISTRATION & OTP FLOW
# ══════════════════════════════════════════════
class TestRegistration:

    def test_student_registration_succeeds(self):
        r = _register("01000000001", "أحمد علي", "student")
        assert r.status_code == 200
        assert "otp_code" in r.json()
        assert r.json()["phone"] == "01000000001"

    def test_broker_registration_succeeds(self):
        r = _register("01000000002", "محمد وسيط", "broker")
        assert r.status_code == 200
        assert "otp_code" in r.json()

    def test_admin_registration_succeeds(self):
        r = _register("01000000003", "مشرف", "admin")
        assert r.status_code == 200
        assert "otp_code" in r.json()

    def test_otp_verification_creates_user_record(self):
        r = _register("01000000004", "فاطمة", "student")
        otp = r.json()["otp_code"]
        v = _verify("01000000004", otp)
        assert v.status_code == 200
        data = v.json()
        assert data["phone"] == "01000000004"
        assert data["account_type"] == "student"
        assert data["is_verified"] is True

    def test_wrong_otp_is_rejected(self):
        _register("01000000005", "Test", "student")
        v = _verify("01000000005", "000000")
        assert v.status_code == 400

    def test_expired_otp_is_rejected(self):
        r = _register("01000000099", "ExpiredUser", "student")
        otp = r.json()["otp_code"]
        db = main_module.SessionLocal()
        entry = db.query(OTPVerification).filter(OTPVerification.phone == "01000000099").first()
        assert entry is not None
        entry.created_at = datetime.utcnow() - timedelta(minutes=15)
        db.commit()
        db.close()
        v = _verify("01000000099", otp)
        assert v.status_code == 400
        assert "صلاحية" in v.json()["detail"]


    def test_duplicate_registration_is_rejected(self):
        _register_and_verify("01000000006", "User", "student")
        r2 = _register("01000000006", "User2", "student")
        assert r2.status_code == 400
        assert "مسجل بالفعل" in r2.json()["detail"]

    def test_blocklisted_phone_cannot_register(self):
        db = main_module.SessionLocal()
        db.add(PhoneBlocklist(phone="01099999999"))
        db.commit()
        db.close()
        r = _register("01099999999", "محظور", "student")
        assert r.status_code == 403
        assert "محظور" in r.json()["detail"]


# ══════════════════════════════════════════════
#  3. LOGIN OTP FLOW
# ══════════════════════════════════════════════
class TestLogin:

    def test_login_otp_sent_for_existing_user(self):
        _register_and_verify("01011111111", "مستخدم", "student")
        r = client.post("/auth/login-otp", json={"phone": "01011111111"})
        assert r.status_code == 200
        assert "otp_code" in r.json()

    def test_login_otp_rejects_unregistered_phone(self):
        r = client.post("/auth/login-otp", json={"phone": "01099000000"})
        assert r.status_code == 404

    def test_login_otp_rejects_blocklisted_phone(self):
        _register_and_verify("01022222222", "مستخدم", "student")
        db = main_module.SessionLocal()
        db.add(PhoneBlocklist(phone="01022222222"))
        db.commit()
        db.close()
        r = client.post("/auth/login-otp", json={"phone": "01022222222"})
        assert r.status_code == 403

    def test_login_verify_logs_user_in(self):
        _register_and_verify("01033333333", "مستخدم", "broker")
        r_otp = client.post("/auth/login-otp", json={"phone": "01033333333"})
        otp = r_otp.json()["otp_code"]
        v = _verify("01033333333", otp)
        assert v.status_code == 200
        assert v.json()["account_type"] == "broker"


# ══════════════════════════════════════════════
#  4. LISTING CRUD
# ══════════════════════════════════════════════
class TestListingCRUD:

    def test_broker_can_create_listing(self):
        broker = _register_and_verify("01044444441", "وسيط", "broker")
        r = _create_listing(broker["id"])
        assert r.status_code == 200
        data = r.json()
        assert data["advertiser_id"] == broker["id"]
        assert data["status"] == "active"

    def test_owner_can_create_listing(self):
        owner = _register_and_verify("01044444442", "مالك", "owner")
        r = _create_listing(owner["id"])
        assert r.status_code == 200

    def test_admin_can_create_listing(self):
        admin = _register_and_verify("01044444443", "مسؤول", "admin")
        r = _create_listing(admin["id"])
        assert r.status_code == 200

    def test_student_cannot_create_listing(self):
        student = _register_and_verify("01044444444", "طالب", "student")
        r = _create_listing(student["id"])
        assert r.status_code == 403
        assert "غير مصرح" in r.json()["detail"]

    def test_listings_appear_in_browse_feed(self):
        broker = _register_and_verify("01044444445", "وسيط", "broker")
        _create_listing(broker["id"])
        r = client.get("/listings")
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_get_listing_detail(self):
        broker = _register_and_verify("01044444446", "وسيط", "broker")
        listing = _create_listing(broker["id"]).json()
        r = client.get(f"/listings/{listing['id']}")
        assert r.status_code == 200
        data = r.json()
        assert "listing" in data
        assert "advertiser" in data
        assert data["advertiser"]["id"] == broker["id"]

    def test_nonexistent_listing_returns_404(self):
        r = client.get("/listings/99999")
        assert r.status_code == 404

    def test_listing_not_shown_if_advertiser_is_banned(self):
        broker = _register_and_verify("01044444447", "وسيط محظور", "broker")
        _create_listing(broker["id"])
        admin = _register_and_verify("01044444448", "مسؤول", "admin")
        client.post(f"/admin/users/{broker['id']}/ban?x_user_id={admin['id']}")
        r = client.get("/listings")
        assert r.status_code == 200
        assert all(l["advertiser_id"] != broker["id"] for l in r.json())


# ══════════════════════════════════════════════
#  5. LISTING FILTERS
# ══════════════════════════════════════════════
class TestListingFilters:

    def _setup_listings(self):
        broker = _register_and_verify("01055500001", "وسيط", "broker")
        _create_listing(broker["id"], governorate="القاهرة", gender="female",
                        room_configurations=[{"room_type": "single", "price_per_person": 1000, "commission": 500}])
        _create_listing(broker["id"], governorate="الجيزة", gender="male",
                        room_configurations=[{"room_type": "double", "price_per_person": 3000, "commission": 1000}])
        return broker

    def test_filter_by_governorate(self):
        self._setup_listings()
        r = client.get("/listings?governorate=القاهرة")
        assert r.status_code == 200
        assert all(l["governorate"] == "القاهرة" for l in r.json())

    def test_filter_by_gender(self):
        self._setup_listings()
        r = client.get("/listings?gender=female")
        assert r.status_code == 200
        assert all(l["gender"] == "female" for l in r.json())

    def test_filter_by_room_type(self):
        self._setup_listings()
        r = client.get("/listings?room_types=single")
        assert r.status_code == 200
        for listing in r.json():
            room_types = [c["room_type"] for c in listing.get("room_configurations", [])]
            assert "single" in room_types

    def test_filter_by_max_price(self):
        self._setup_listings()
        r = client.get("/listings?max_price=1500")
        assert r.status_code == 200
        for listing in r.json():
            prices = [c["price_per_person"] for c in listing.get("room_configurations", [])]
            assert any(p <= 1500 for p in prices)

    def test_filter_by_min_price(self):
        self._setup_listings()
        r = client.get("/listings?min_price=2000")
        assert r.status_code == 200
        for listing in r.json():
            prices = [c["price_per_person"] for c in listing.get("room_configurations", [])]
            assert any(p >= 2000 for p in prices)


# ══════════════════════════════════════════════
#  5b. COMMISSION PERCENTAGE FILTER (min/max)
# ══════════════════════════════════════════════
class TestCommissionPercentageFilter:

    def _setup(self):
        broker = _register_and_verify("01077700001", "وسيط عمولة", "broker")

        def add(title, config):
            resp = _create_listing(broker["id"], title=title, room_configurations=[config])
            assert resp.status_code == 200, f"create {title} failed: {resp.text}"
            return resp.json()

        owner = _register_and_verify("01077700002", "مالك", "owner")
        owner_listing = _create_listing(owner["id"], title="OWNER_0").json()

        listings = {
            "OWNER_0": owner_listing,
        }
        listings["FIX_10"] = add("FIX_10", {"room_type": "single", "price_per_person": 1000, "commission": 10, "commission_pct": 10, "commission_type": "fixed"})
        listings["FIX_20"] = add("FIX_20", {"room_type": "single", "price_per_person": 1000, "commission": 20, "commission_pct": 20, "commission_type": "fixed"})
        listings["FIX_30"] = add("FIX_30", {"room_type": "single", "price_per_person": 1000, "commission": 30, "commission_pct": 30, "commission_type": "fixed"})
        listings["FIX_40"] = add("FIX_40", {"room_type": "single", "price_per_person": 1000, "commission": 40, "commission_pct": 40, "commission_type": "fixed"})
        listings["FIX_50"] = add("FIX_50", {"room_type": "single", "price_per_person": 1000, "commission": 50, "commission_pct": 50, "commission_type": "fixed"})

        def rng(title, lo, hi):
            return add(title, {"room_type": "single", "price_per_person": 1000, "commission_type": "range", "commission_min": lo, "commission_max": hi, "commission_min_pct": lo, "commission_max_pct": hi})

        listings["R_20_50"] = rng("R_20_50", 20, 50)
        listings["R_30_40"] = rng("R_30_40", 30, 40)
        listings["R_40_60"] = rng("R_40_60", 40, 60)
        listings["R_10_15"] = rng("R_10_15", 10, 15)
        listings["R_40_50"] = rng("R_40_50", 40, 50)
        listings["R_50_60"] = rng("R_50_60", 50, 60)
        listings["R_50_70"] = rng("R_50_70", 50, 70)

        listings["UNKNOWN"] = add("UNKNOWN", {"room_type": "single", "price_per_person": 1000, "commission": None})
        listings["LEGACY_MONEY"] = add("LEGACY_MONEY", {"room_type": "single", "price_per_person": 1000, "commission": 750})
        return listings

    def _filter_titles(self, query):
        r = client.get(f"/listings?{query}")
        assert r.status_code == 200, f"status {r.status_code}: {r.text}"
        return {item["title"] for item in r.json()}

    def test_no_commission_params_returns_all(self):
        self._setup()
        titles = self._filter_titles("")
        assert {"OWNER_0", "FIX_10", "FIX_20", "FIX_30", "FIX_40", "FIX_50", "R_20_50", "R_30_40", "R_40_60", "R_10_15", "R_40_50", "R_50_60", "R_50_70", "UNKNOWN", "LEGACY_MONEY"}.issubset(titles)

    def test_filter_0_to_30(self):
        self._setup()
        titles = self._filter_titles("max_commission=30")
        assert "OWNER_0" in titles
        assert "FIX_10" in titles
        assert "FIX_30" in titles
        assert "FIX_40" not in titles
        assert "R_20_50" in titles
        assert "R_30_40" in titles
        assert "R_40_60" not in titles
        assert "UNKNOWN" not in titles
        assert "LEGACY_MONEY" not in titles

    def test_filter_min_only_20(self):
        self._setup()
        titles = self._filter_titles("min_commission=20")
        assert "OWNER_0" not in titles
        assert "FIX_30" in titles
        assert "FIX_10" not in titles
        assert "R_20_50" in titles
        assert "R_10_15" not in titles

    def test_filter_max_only_30(self):
        self._setup()
        titles = self._filter_titles("max_commission=30")
        assert "OWNER_0" in titles
        assert "FIX_20" in titles
        assert "FIX_30" in titles
        assert "FIX_40" not in titles
        assert "R_20_50" in titles
        assert "R_40_50" not in titles

    def test_filter_min_20_max_40(self):
        self._setup()
        titles = self._filter_titles("min_commission=20&max_commission=40")
        assert "OWNER_0" not in titles
        assert "FIX_30" in titles
        assert "FIX_10" not in titles
        assert "FIX_50" not in titles
        assert "R_20_50" in titles
        assert "R_10_15" not in titles
        assert "R_40_60" in titles
        assert "R_50_60" not in titles


# ══════════════════════════════════════════════
#  6. BEDS UPDATE & REPUBLISH
# ══════════════════════════════════════════════
class TestBedsAndRepublish:

    def test_update_available_beds(self):
        broker = _register_and_verify("01066600001", "وسيط", "broker")
        headers = {"Authorization": f"Bearer {broker.get('auth_token')}"} if broker.get("auth_token") else {"x-user-id": str(broker["id"])}
        listing = _create_listing(broker["id"]).json()
        r = client.post(f"/listings/{listing['id']}/beds", json={"available_beds": 5}, headers=headers)
        assert r.status_code == 200
        assert r.json()["available_beds"] == 5

    def test_beds_to_zero_marks_listing_inactive(self):
        broker = _register_and_verify("01066600002", "وسيط", "broker")
        headers = {"Authorization": f"Bearer {broker.get('auth_token')}"} if broker.get("auth_token") else {"x-user-id": str(broker["id"])}
        listing = _create_listing(broker["id"]).json()
        r = client.post(f"/listings/{listing['id']}/beds", json={"available_beds": 0}, headers=headers)
        assert r.status_code == 200
        assert r.json()["status"] == "inactive"

    def test_republish_reactivates_listing(self):
        broker = _register_and_verify("01066600003", "وسيط", "broker")
        headers = {"Authorization": f"Bearer {broker.get('auth_token')}"} if broker.get("auth_token") else {"x-user-id": str(broker["id"])}
        listing = _create_listing(broker["id"]).json()
        client.post(f"/listings/{listing['id']}/beds", json={"available_beds": 0}, headers=headers)
        r = client.post(f"/listings/{listing['id']}/republish", json={"available_beds": 3}, headers=headers)
        assert r.status_code == 200
        assert r.json()["status"] == "active"
        assert r.json()["available_beds"] == 3


# ══════════════════════════════════════════════
#  7. RATINGS
# ══════════════════════════════════════════════
class TestRatings:

    def _setup(self):
        student = _register_and_verify("01077700001", "طالب", "student")
        broker = _register_and_verify("01077700002", "وسيط", "broker")
        listing = _create_listing(broker["id"]).json()
        return student, broker, listing

    def test_student_can_rate_advertiser(self):
        student, broker, listing = self._setup()
        r = client.post("/ratings/advertiser", json={
            "listing_id": listing["id"],
            "student_id": student["id"],
            "star_count": 5,
            "review_text": "معلن ممتاز وسريع في الرد",
        })
        assert r.status_code == 200
        assert r.json()["star_count"] == 5
        assert r.json()["target_type"] == "advertiser"

    def test_student_can_rate_property(self):
        student, broker, listing = self._setup()
        r = client.post("/ratings/property", json={
            "listing_id": listing["id"],
            "student_id": student["id"],
            "star_count": 4,
            "review_text": "مكان نظيف ومريح",
        })
        assert r.status_code == 200
        assert r.json()["target_type"] == "property"

    def test_ratings_appear_in_listing_detail(self):
        student, broker, listing = self._setup()
        client.post("/ratings/property", json={
            "listing_id": listing["id"],
            "student_id": student["id"],
            "star_count": 4,
            "review_text": "ممتاز",
        })
        r = client.get(f"/listings/{listing['id']}")
        assert r.status_code == 200
        assert len(r.json()["property_ratings"]) == 1

    def test_invalid_star_count_rejected(self):
        student, broker, listing = self._setup()
        r = client.post("/ratings/advertiser", json={
            "listing_id": listing["id"],
            "student_id": student["id"],
            "star_count": 10,
            "review_text": "ممتاز",
        })
        assert r.status_code == 422  # Pydantic validation


# ══════════════════════════════════════════════
#  8. COMPLAINTS
# ══════════════════════════════════════════════
class TestComplaints:

    def _setup(self):
        student = _register_and_verify("01088800001", "طالب", "student")
        broker = _register_and_verify("01088800002", "وسيط", "broker")
        listing = _create_listing(broker["id"]).json()
        return student, broker, listing

    def test_student_can_submit_complaint(self):
        student, broker, listing = self._setup()
        r = client.post("/complaints", json={
            "listing_id": listing["id"],
            "student_id": student["id"],
            "violation_type": "السعر المطلوب أعلى من المعلن",
            "description": "الإيجار المطلوب أعلى بكثير مما هو معلن",
        })
        assert r.status_code == 200
        assert r.json()["status"] == "submitted"
        assert r.json()["violation_type"] == "السعر المطلوب أعلى من المعلن"

    def test_complaint_for_nonexistent_listing_fails(self):
        student = _register_and_verify("01088800003", "طالب", "student")
        r = client.post("/complaints", json={
            "listing_id": 99999,
            "student_id": student["id"],
            "violation_type": "أخرى",
            "description": "test",
        })
        assert r.status_code == 404


# ══════════════════════════════════════════════
#  9. ADMIN PRIVILEGE ENFORCEMENT
# ══════════════════════════════════════════════
class TestAdminPrivileges:

    def _setup(self):
        admin = _register_and_verify("01099900001", "مسؤول", "admin")
        broker = _register_and_verify("01099900002", "وسيط", "broker")
        student = _register_and_verify("01099900003", "طالب", "student")
        listing = _create_listing(broker["id"]).json()
        complaint = client.post("/complaints", json={
            "listing_id": listing["id"],
            "student_id": student["id"],
            "violation_type": "السعر المطلوب أعلى من المعلن",
            "description": "وصف المشكلة",
        }).json()
        return admin, broker, student, listing, complaint

    def test_admin_can_view_all_complaints(self):
        admin, *_ = self._setup()
        r = client.get(f"/admin/complaints?x_user_id={admin['id']}")
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_admin_can_dismiss_complaint(self):
        admin, broker, student, listing, complaint = self._setup()
        r = client.post(f"/admin/complaints/{complaint['id']}/dismiss?x_user_id={admin['id']}")
        assert r.status_code == 200
        assert r.json()["status"] == "dismissed"

    def test_admin_can_warn_advertiser(self):
        admin, broker, student, listing, complaint = self._setup()
        r = client.post(f"/admin/complaints/{complaint['id']}/warn?x_user_id={admin['id']}")
        assert r.status_code == 200
        assert r.json()["status"] == "warned"
        # Offense count incremented
        users = client.get(f"/admin/users?x_user_id={admin['id']}").json()
        broker_data = next(u for u in users if u["id"] == broker["id"])
        assert broker_data["offense_count"] == 1

    def test_second_warning_triggers_auto_ban(self):
        admin = _register_and_verify("01099910001", "مسؤول", "admin")
        broker = _register_and_verify("01099910002", "وسيط", "broker")
        student = _register_and_verify("01099910003", "طالب", "student")
        listing = _create_listing(broker["id"]).json()

        # First complaint → warn
        c1 = client.post("/complaints", json={
            "listing_id": listing["id"],
            "student_id": student["id"],
            "violation_type": "أخرى",
            "description": "المخالفة الأولى",
        }).json()
        client.post(f"/admin/complaints/{c1['id']}/warn?x_user_id={admin['id']}")

        # Second complaint → warn again → auto-ban
        c2 = client.post("/complaints", json={
            "listing_id": listing["id"],
            "student_id": student["id"],
            "violation_type": "أخرى",
            "description": "المخالفة الثانية",
        }).json()
        client.post(f"/admin/complaints/{c2['id']}/warn?x_user_id={admin['id']}")

        users = client.get(f"/admin/users?x_user_id={admin['id']}").json()
        broker_data = next(u for u in users if u["id"] == broker["id"])
        assert broker_data["is_banned"] is True

    def test_admin_direct_ban_user(self):
        admin, broker, student, listing, complaint = self._setup()
        r = client.post(f"/admin/users/{broker['id']}/ban?x_user_id={admin['id']}")
        assert r.status_code == 200
        assert r.json()["is_banned"] is True

    def test_admin_can_unban_user(self):
        admin, broker, student, listing, complaint = self._setup()
        client.post(f"/admin/users/{broker['id']}/ban?x_user_id={admin['id']}")
        r = client.post(f"/admin/users/{broker['id']}/unban?x_user_id={admin['id']}")
        assert r.status_code == 200
        assert r.json()["is_banned"] is False

    def test_admin_can_deactivate_listing(self):
        admin, broker, student, listing, complaint = self._setup()
        r = client.post(f"/admin/listings/{listing['id']}/deactivate?x_user_id={admin['id']}")
        assert r.status_code == 200
        assert r.json()["status"] == "inactive"

    def test_admin_can_view_all_users(self):
        admin, broker, student, listing, complaint = self._setup()
        r = client.get(f"/admin/users?x_user_id={admin['id']}")
        assert r.status_code == 200
        assert len(r.json()) >= 3

    def test_admin_can_view_all_listings(self):
        admin, broker, student, listing, complaint = self._setup()
        r = client.get(f"/admin/listings?x_user_id={admin['id']}")
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_non_admin_cannot_access_admin_endpoints(self):
        student = _register_and_verify("01099920001", "طالب", "student")
        r = client.get(f"/admin/complaints?x_user_id={student['id']}")
        assert r.status_code == 403

    def test_broker_cannot_access_admin_endpoints(self):
        broker = _register_and_verify("01099920002", "وسيط", "broker")
        r = client.get(f"/admin/users?x_user_id={broker['id']}")
        assert r.status_code == 403

    def test_unauthenticated_cannot_access_admin_ban(self):
        admin, broker, *_ = self._setup()
        # No x_user_id supplied → should fail with 403
        r = client.post(f"/admin/users/{broker['id']}/ban")
        assert r.status_code == 403

    def test_ban_adds_phone_to_blocklist(self):
        admin, broker, student, listing, complaint = self._setup()
        client.post(f"/admin/users/{broker['id']}/ban?x_user_id={admin['id']}")
        # Attempting to register with same phone should fail
        r = _register(broker["phone"], "محاولة", "broker")
        assert r.status_code == 403

    def test_unban_removes_phone_from_blocklist(self):
        admin, broker, student, listing, complaint = self._setup()
        client.post(f"/admin/users/{broker['id']}/ban?x_user_id={admin['id']}")
        client.post(f"/admin/users/{broker['id']}/unban?x_user_id={admin['id']}")
        # Should be able to re-login (not register again—already exists)
        r = client.post("/auth/login-otp", json={"phone": broker["phone"]})
        assert r.status_code == 200
