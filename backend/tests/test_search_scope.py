# -*- coding: utf-8 -*-
import sys
import os
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.main as main_module
from app.main import app, Listing, User

client = TestClient(app)

def setup_search_test_data():
    db = main_module.SessionLocal()
    # Ensure previous tests don't interfere (or we can just create unique ones)
    
    # Create advertiser
    import uuid
    advertiser = User(
        phone=f"015{uuid.uuid4().hex[:8]}",
        name="Advertiser Search Tester",
        account_type="owner",
        is_verified=True,
        is_banned=False
    )
    db.add(advertiser)
    db.commit()
    db.refresh(advertiser)
    
    # Common listing params
    common = {
        "advertiser_id": advertiser.id,
        "gender": "male",
        "available_beds": 2,
        "pricing_mode": "room_based",
        "status": "active"
    }

    listings = [
        # Listing A: Match in Title
        Listing(
            title="سكن في مدينة نصر",
            governorate="القاهرة",
            city="القاهرة",
            neighborhood="مصر الجديدة",
            address="شارع 10",
            description="وصف فارغ",
            **common
        ),
        # Listing B: Match in City (but not title)
        Listing(
            title="سكن هادئ",
            governorate="الدقهلية",
            city="المنصورة",
            neighborhood="حي الجامعة",
            address="شارع الجمهورية",
            description="وصف",
            **common
        ),
        # Listing C: Match in Neighborhood
        Listing(
            title="سكن قريب من الخدمات",
            governorate="الإسكندرية",
            city="الإسكندرية",
            neighborhood="سموحة",
            address="شارع 14",
            description="وصف",
            **common
        ),
        # Listing D: Full address search & E: Landmark search
        Listing(
            title="شقة للطلاب",
            governorate="القاهرة",
            city="القاهرة",
            neighborhood="المعادي",
            address="الدور الأول، خلف الجزار، بجوار الجامعة",
            description="جيدة جدا",
            **common
        ),
        # Listing F: Description search
        Listing(
            title="شقة مميزة",
            governorate="القاهرة",
            city="القاهرة",
            neighborhood="الهرم",
            address="شارع الهرم",
            description="الشقة قريبة من موقف الجامعة والسوبر ماركت",
            **common
        ),
        # Listing G: Empty description
        Listing(
            title="شقة عادية",
            governorate="القاهرة",
            city="القاهرة",
            neighborhood="الهرم",
            address="شارع الهرم",
            description=None,
            **common
        ),
        # Listing H: Arabic variations
        Listing(
            title="شقة بجوار أحمد",
            governorate="القاهرة",
            city="القاهرة",
            neighborhood="أحمد",
            address="شارع أحمد",
            description="أحمد",
            **common
        )
    ]
    
    for l in listings:
        db.add(l)
    db.commit()
    
    return advertiser, listings

def test_search_scope():
    advertiser, listings = setup_search_test_data()
    
    # A - Title search
    res = client.get("/listings?neighborhood=مدينة نصر")
    assert res.status_code == 200
    titles = [l["title"] for l in res.json()]
    assert "سكن في مدينة نصر" in titles

    # B - City search
    res = client.get("/listings?neighborhood=المنصورة")
    assert res.status_code == 200
    titles = [l["title"] for l in res.json()]
    assert "سكن هادئ" in titles

    # C - Neighborhood search
    res = client.get("/listings?neighborhood=سموحة")
    assert res.status_code == 200
    titles = [l["title"] for l in res.json()]
    assert "سكن قريب من الخدمات" in titles

    # D & E - Full address / landmark search
    res = client.get("/listings?neighborhood=الجزار")
    assert res.status_code == 200
    titles = [l["title"] for l in res.json()]
    assert "شقة للطلاب" in titles

    # F - Description search
    res = client.get("/listings?neighborhood=موقف الجامعة")
    assert res.status_code == 200
    titles = [l["title"] for l in res.json()]
    assert "شقة مميزة" in titles

    # G - Advertiser Name search (should NOT match)
    res = client.get("/listings?neighborhood=Advertiser Search Tester")
    assert res.status_code == 200
    # Should not find listings based on advertiser name
    titles = [l["title"] for l in res.json()]
    assert len(titles) == 0

    # H - Empty description (doesn't crash)
    # The empty description listing should still be found by its title
    res = client.get("/listings?neighborhood=شقة عادية")
    assert res.status_code == 200
    titles = [l["title"] for l in res.json()]
    assert "شقة عادية" in titles

    # I - Arabic variations (if ilike handles it natively, SQLite might just exact match, 
    # but we will test exact match here to ensure it finds it. The prompt asks to verify according to existing behavior).
    res = client.get("/listings?neighborhood=أحمد")
    assert res.status_code == 200
    titles = [l["title"] for l in res.json()]
    assert "شقة بجوار أحمد" in titles

    # J - Existing filters
    res = client.get("/listings?neighborhood=الجزار&gender=male")
    assert res.status_code == 200
    titles = [l["title"] for l in res.json()]
    assert "شقة للطلاب" in titles

    res = client.get("/listings?neighborhood=الجزار&gender=female")
    assert res.status_code == 200
    titles = [l["title"] for l in res.json()]
    assert "شقة للطلاب" not in titles
