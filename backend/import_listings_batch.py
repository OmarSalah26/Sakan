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
    Ensures account is NOT admin under any circumstance.
    """
    if not target_phone:
        return None

    raw_target = str(target_phone).strip()
    digits = normalize_digits(raw_target)
    if not digits:
        return None

    last10 = digits[-10:] if len(digits) >= 10 else digits

    # Candidate phone strings for direct SQL indexing
    candidates = {
        raw_target,
        digits,
        f"+{digits}",
        f"+20{last10}",
        f"0{last10}",
        f"20{last10}",
        last10,
    }
    candidates = {c for c in candidates if c}

    # 1. Exact SQL match (strictly non-admin)
    user = db_session.query(User).filter(
        User.phone.in_(list(candidates)),
        User.account_type != "admin"
    ).first()
    if user:
        return user

    # 2. Iterate and match by normalized digits (handles spaces like '+20 10 08253016')
    all_users = db_session.query(User).filter(User.account_type != "admin").all()
    for u in all_users:
        u_digits = normalize_digits(u.phone)
        if u_digits and last10:
            if u_digits == digits or u_digits.endswith(last10) or digits.endswith(u_digits[-10:]):
                return u

    return None


def run_batch_import(json_file_path: str, dry_run: bool = False, db_url: str = None):
    print("=========================================================================================")
    print("                 SAKAN - MULTI-ACCOUNT BATCH LISTING IMPORT UTILITY                     ")
    print(f" Timestamp: {datetime.now().isoformat()}")
    print(f" Mode: {'[DRY RUN - READ ONLY]' if dry_run else '[LIVE EXECUTION - REAL DATABASE WRITES]'}")
    print("=========================================================================================\n")

    # 1. Resolve Database Engine
    if not db_url:
        db_url = os.environ.get("DATABASE_URL")

    connect_args = {}
    if db_url:
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        import re, socket, time
        sanitized_url = re.sub(r':([^@]+)@', ':****@', db_url)
        print(f"[DATABASE] Target Database: {sanitized_url}")
        host_match = re.search(r'@([^:/]+)', db_url)
        if host_match:
            target_host = host_match.group(1)
            resolved_ip = None
            for attempt in range(5):
                try:
                    resolved_ip = socket.gethostbyname(target_host)
                    break
                except Exception:
                    time.sleep(1.5)
            if not resolved_ip and "oregon-postgres.render.com" in target_host:
                resolved_ip = "35.227.164.209"
            if resolved_ip:
                connect_args["hostaddr"] = resolved_ip
    else:
        db_file = BASE_DIR / "sakan.db"
        db_url = f"sqlite:///{db_file}"
        print(f"[DATABASE] DATABASE_URL not provided. Using local SQLite: {db_file}")

    engine = create_engine(db_url, connect_args=connect_args)
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

    # 3. Process Listings with Per-Listing Advertiser Matching
    total_processed = 0
    total_to_create = 0
    total_skipped_duplicates = 0
    total_unmatched = 0
    unmatched_listings = []
    listings_to_add = []
    advertiser_cache = {}  # Cache phone -> User to minimize DB queries

    print("-" * 110)
    print(f"{'#':<3} | {'Status':<10} | {'Adv ID':<6} | {'Advertiser Name':<16} | {'Rent':<10} | {'Beds':<4} | {'Title'}")
    print("-" * 110)

    for idx, item in enumerate(raw_data, start=1):
        total_processed += 1
        title = (item.get("title") or "سكن طلاب").strip()
        target_phone = item.get("contact_phone") or item.get("whatsapp_phone") or ""

        # A. Look up advertiser account for this specific listing
        if target_phone in advertiser_cache:
            advertiser = advertiser_cache[target_phone]
        else:
            advertiser = find_advertiser_by_phone(db, target_phone)
            advertiser_cache[target_phone] = advertiser

        if not advertiser:
            total_unmatched += 1
            adv_name = item.get("advertiser_name") or "Unknown"
            unmatched_listings.append({
                "index": idx,
                "phone": target_phone,
                "name": adv_name,
                "title": title
            })
            print(f"{idx:<3} | {'UNMATCHED':<10} | {'---':<6} | {adv_name[:16]:<16} | {'---':<10} | {'-':<4} | [SKIPPED - No account for {target_phone}] {title[:30]}")
            continue

        # B. Idempotency Check: True duplicate check
        # A listing is only a true duplicate if it matches the same advertiser, same title,
        # AND matching description or photos (avoids falsely skipping different apartments sharing generic titles)
        description = (item.get("description") or "").strip()
        item_photos = set(item.get("photo_urls") or [])

        candidates = db.query(Listing).filter(
            Listing.advertiser_id == advertiser.id,
            Listing.title == title
        ).all()

        existing = None
        for cand in candidates:
            cand_desc = (cand.description or "").strip()
            if description and cand_desc and cand_desc == description:
                existing = cand
                break
            if cand.photo_urls and item_photos:
                try:
                    cand_photos = set(json.loads(cand.photo_urls))
                    if cand_photos & item_photos:
                        existing = cand
                        break
                except Exception:
                    pass

        if existing:
            total_skipped_duplicates += 1
            print(f"{idx:<3} | {'SKIP-DUP':<10} | {advertiser.id:<6} | {advertiser.name[:16]:<16} | {'---':<10} | {'-':<4} | [DUPLICATE ID: {existing.id}] {title[:40]}")
            continue

        # C. Pricing Logic
        raw_price = item.get("price_per_person")
        total_price = float(raw_price) if raw_price is not None else None
        price_per_person = None  # Explicitly None
        pricing_mode = "total_based"
        show_total_price = True  # Explicitly True for all listings in this batch

        # D. Status & Rented-Listing Detection
        raw_desc = (item.get("description") or "") + " " + title + " " + (item.get("address") or "")
        if "اتاجرت" in raw_desc or "🔴اتاجرت🔴" in raw_desc or "اتحجزت" in raw_desc:
            status = "inactive"
            available_beds = 0
        else:
            status = "active"
            available_beds = int(item.get("available_beds") or 0)

        # E. JSON Columns Serialization
        amenities_json = json.dumps(item.get("amenities", []), ensure_ascii=False)
        photo_urls_json = json.dumps(item.get("photo_urls", []), ensure_ascii=False)
        video_urls_json = json.dumps(item.get("video_urls", []), ensure_ascii=False)
        room_configs_json = json.dumps(item.get("room_configurations", []), ensure_ascii=False)

        # F. Location & Address Fields
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
            contact_phone=advertiser.phone or target_phone,
            whatsapp_phone=advertiser.phone or target_phone,
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
        print(f"{idx:<3} | {status:<10} | {advertiser.id:<6} | {advertiser.name[:16]:<16} | {rent_display:<10} | {available_beds:<4} | {title[:40]}")

    print("-" * 110)
    print("\n" + "=" * 45 + " SUMMARY " + "=" * 45)
    print(f" Total records in JSON file:         {total_processed}")
    print(f" Records matched & ready to create:  {total_to_create}")
    print(f" Duplicates skipped:                 {total_skipped_duplicates}")
    print(f" Unmatched accounts skipped:         {total_unmatched}")

    if unmatched_listings:
        print("\n--- Unmatched Listings Breakdown (Review Needed) ---")
        for un in unmatched_listings:
            print(f"  Item #{un['index']:<2} | Phone: {un['phone']:<16} | Adv: {un['name']:<14} | Title: {un['title']}")

    print("=" * 99)

    if dry_run:
        print("\n[DRY RUN COMPLETE] No records were committed to the database.")
        db.close()
        return {
            "status": "dry_run_success",
            "total_processed": total_processed,
            "total_to_create": total_to_create,
            "total_skipped_duplicates": total_skipped_duplicates,
            "total_unmatched": total_unmatched,
            "unmatched_listings": unmatched_listings
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
            print("\n[INFO] No new listings to commit.")

        db.close()
        return {
            "status": "live_success",
            "total_processed": total_processed,
            "created_count": len(listings_to_add),
            "total_skipped_duplicates": total_skipped_duplicates,
            "total_unmatched": total_unmatched,
            "unmatched_listings": unmatched_listings
        }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import scraped listings from JSON into Sakan database with per-listing advertiser matching.")
    parser.add_argument("json_file", help="Path to the listings JSON file")
    parser.add_argument("--dry-run", action="store_true", help="Parse and validate without committing to DB")
    parser.add_argument("--db-url", help="Database URL connection string (SQLite or PostgreSQL)")

    args = parser.parse_args()
    run_batch_import(args.json_file, dry_run=args.dry_run, db_url=args.db_url)
