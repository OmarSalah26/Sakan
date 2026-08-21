import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

# Set up Python path for backend imports
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

# Ensure UTF-8 output in Windows consoles
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

try:
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker
    from app.main import Base, Listing, User, format_phone_e164
except ImportError as e:
    print(f"[ERROR] Failed importing application models: {e}")
    sys.exit(1)


def normalize_digits(phone: str) -> str:
    """Extract only numeric digits from phone string."""
    return ''.join(c for c in (phone or '') if c.isdigit())


def find_advertiser_by_phone(db_session, target_phone: str):
    """
    Find user by phone number using exact match, e164 normalization,
    and digit comparison to support all legacy/production formats.
    """
    raw_target = target_phone.strip()
    digits = normalize_digits(raw_target)
    
    # Candidate phone strings
    candidates = {
        raw_target,
        f"+{digits}" if digits else "",
        digits,
        f"0{digits[2:]}" if digits.startswith("20") and len(digits) == 12 else "",
        digits[2:] if digits.startswith("20") else "",
    }
    candidates = {c for c in candidates if c}

    # 1. Exact SQL match
    user = db_session.query(User).filter(User.phone.in_(list(candidates))).first()
    if user:
        return user

    # 2. Iterate and match by normalized digits (handles spaces like '+20 10 00106097')
    all_users = db_session.query(User).all()
    for u in all_users:
        u_digits = normalize_digits(u.phone)
        if u_digits and digits:
            # Match 10 or 11/12 digits (e.g. 01000106097 vs 201000106097 vs 1000106097)
            if u_digits == digits or u_digits.endswith(digits[-10:]) or digits.endswith(u_digits[-10:]):
                return u

    return None


def run_batch_import(json_file_path: str, dry_run: bool = False, db_url: str = None):
    print("=================================================================")
    print("        SAKAN - BATCH LISTING IMPORT UTILITY                     ")
    print(f" Timestamp: {datetime.now().isoformat()}")
    print(f" Mode: {'[DRY RUN - READ ONLY]' if dry_run else '[LIVE EXECUTION - REAL DATABASE WRITES]'}")
    print("=================================================================\n")

    # 1. Resolve Database Engine
    if not db_url:
        db_url = os.environ.get("DATABASE_URL")

    if db_url:
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        import re
        sanitized_url = re.sub(r':([^@]+)@', ':****@', db_url)
        print(f"[DATABASE] Target Database: {sanitized_url}")
    else:
        db_file = BASE_DIR / "sakan.db"
        db_url = f"sqlite:///{db_file}"
        print(f"[DATABASE] DATABASE_URL not provided. Using local SQLite: {db_file}")

    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    db = Session()

    # 2. Load and Validate JSON file
    json_path = Path(json_file_path)
    if not json_path.is_absolute():
        json_path = BASE_DIR / json_path

    if not json_path.exists():
        print(f"[FATAL] JSON file not found: {json_path}")
        sys.exit(1)

    try:
        with open(json_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
    except Exception as e:
        print(f"[FATAL] Failed reading JSON file: {e}")
        sys.exit(1)

    if not isinstance(raw_data, list):
        print(f"[FATAL] JSON root must be a list of listings, got {type(raw_data).__name__}")
        sys.exit(1)

    print(f"[INFO] Successfully loaded {len(raw_data)} listings from: {json_path.name}\n")

    # 3. Lookup Advertiser Account (Requirement A)
    target_phone = "+201000106097"
    advertiser = find_advertiser_by_phone(db, target_phone)

    if not advertiser:
        print(f"[FATAL - STOPPED] Advertiser with phone '{target_phone}' was NOT found in the database!")
        print("Per Requirement A.3: Auto-creation is DISABLED. Import aborted.")
        print("Please verify the target database contains this user or review phone formatting.")
        db.close()
        sys.exit(2)

    print(f"[ADVERTISER FOUND] ID: {advertiser.id} | Name: '{advertiser.name}' | Phone: '{advertiser.phone}' | Type: '{advertiser.account_type}'\n")

    # 4. Process Listings
    total_processed = 0
    total_to_create = 0
    total_skipped_duplicates = 0
    errors = []
    listings_to_add = []

    print("-" * 80)
    print(f"{'#':<3} | {'Status':<8} | {'Total Rent':<10} | {'Beds':<4} | {'ShowTot':<7} | {'Title'}")
    print("-" * 80)

    for idx, item in enumerate(raw_data, start=1):
        total_processed += 1
        title = (item.get("title") or "سكن طلاب").strip()

        # A. Idempotency Check: Existing listing with same title AND advertiser_id
        existing = db.query(Listing).filter(
            Listing.advertiser_id == advertiser.id,
            Listing.title == title
        ).first()

        if existing:
            total_skipped_duplicates += 1
            print(f"{idx:<3} | {'SKIP-DUP':<8} | {'---':<10} | {'-':<4} | {'-':<7} | {title[:45]} (ID: {existing.id})")
            continue

        # B. Pricing Logic (Requirement B)
        # Raw price in price_per_person represents total apartment rent
        raw_price = item.get("price_per_person")
        total_price = float(raw_price) if raw_price is not None else None
        price_per_person = None  # Explicitly None
        pricing_mode = "total_based"
        show_total_price = True  # Explicitly True for all listings in this batch

        # C. Status & Rented-Listing Detection (Requirement C)
        raw_desc = (item.get("description") or "") + " " + title
        if "اتاجرت" in raw_desc or "🔴اتاجرت🔴" in raw_desc:
            status = "inactive"
            available_beds = 0
        else:
            status = "active"
            available_beds = int(item.get("available_beds", 0))

        # D. JSON Columns Serialization (Requirement D)
        amenities_json = json.dumps(item.get("amenities", []), ensure_ascii=False)
        photo_urls_json = json.dumps(item.get("photo_urls", []), ensure_ascii=False)
        video_urls_json = json.dumps(item.get("video_urls", []), ensure_ascii=False)
        room_configs_json = json.dumps(item.get("room_configurations", []), ensure_ascii=False)

        # E. Location & Address Fields (Requirement E)
        address = (item.get("address") or item.get("full_address") or "").strip()
        floor_val = str(item["floor"]).strip() if item.get("floor") is not None else None

        # Build Listing Object
        listing_obj = Listing(
            title=title,
            governorate=item.get("governorate") or "دمياط",
            city=item.get("city") or "دمياط الجديدة",
            neighborhood=item.get("neighborhood") or "",
            address=address,
            street=item.get("street"),
            building_number=item.get("building_number"),
            apartment_number=item.get("apartment_number"),
            floor=floor_val,
            maps_link=item.get("maps_link"),
            latitude=float(item["latitude"]) if item.get("latitude") is not None else None,
            longitude=float(item["longitude"]) if item.get("longitude") is not None else None,
            location_precise=bool(item.get("location_precise", False)),
            gender=item.get("gender") or "male",
            available_beds=available_beds,
            price_per_person=price_per_person,
            room_type=item.get("room_type"),
            total_price=total_price,
            pricing_mode=pricing_mode,
            show_total_price=show_total_price,
            room_configurations=room_configs_json,
            amenities=amenities_json,
            photo_urls=photo_urls_json,
            video_urls=video_urls_json,
            description=item.get("description") or "",
            cover_photo_index=int(item.get("cover_photo_index") or 0),
            tier=item.get("tier") or "regular",
            status=status,
            min_lease_months=int(item["min_lease_months"]) if item.get("min_lease_months") is not None else None,
            contact_phone=item.get("contact_phone") or advertiser.phone,
            whatsapp_phone=item.get("whatsapp_phone") or advertiser.phone,
            source=item.get("source") or "telegram",
            full_edit_available=bool(item.get("full_edit_available", False)),
            edit_token=item.get("edit_token"),
            not_vacant_reports=int(item.get("not_vacant_reports") or 0),
            near_university=bool(item.get("near_university", False)),
            near_transit=bool(item.get("near_transit", False)),
            advertiser_id=advertiser.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        listings_to_add.append(listing_obj)
        total_to_create += 1
        rent_display = f"{int(total_price):,} EGP" if total_price else "None"
        print(f"{idx:<3} | {status:<8} | {rent_display:<10} | {available_beds:<4} | {str(show_total_price):<7} | {title[:45]}")

    print("-" * 80)
    print("\n==================== SUMMARY ====================")
    print(f" Total records in JSON file: {total_processed}")
    print(f" Records to create:          {total_to_create}")
    print(f" Duplicates skipped:         {total_skipped_duplicates}")
    print(f" Errors encountered:         {len(errors)}")
    print("=================================================")

    adv_id = advertiser.id
    if dry_run:
        print("\n[DRY RUN COMPLETE] No records were committed to the database.")
        db.close()
        return {
            "status": "dry_run_success",
            "advertiser_id": adv_id,
            "total_processed": total_processed,
            "total_to_create": total_to_create,
            "total_skipped_duplicates": total_skipped_duplicates,
        }
    else:
        if listings_to_add:
            try:
                db.add_all(listings_to_add)
                db.commit()
                print(f"\n[SUCCESS] Successfully committed {len(listings_to_add)} listings to database.")
            except Exception as e:
                db.rollback()
                print(f"\n[DATABASE ERROR] Failed committing listings: {e}")
                db.close()
                sys.exit(1)
        else:
            print("\n[INFO] No new listings to commit (all were duplicates).")

        db.close()
        return {
            "status": "live_success",
            "advertiser_id": adv_id,
            "total_processed": total_processed,
            "created_count": len(listings_to_add),
            "total_skipped_duplicates": total_skipped_duplicates,
        }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import scraped listings from JSON into Sakan database.")
    parser.add_argument("json_file", help="Path to the listings JSON file")
    parser.add_argument("--dry-run", action="store_true", help="Parse and validate without committing to DB")
    parser.add_argument("--db-url", help="Database URL connection string (SQLite or PostgreSQL)")

    args = parser.parse_args()
    run_batch_import(args.json_file, dry_run=args.dry_run, db_url=args.db_url)
