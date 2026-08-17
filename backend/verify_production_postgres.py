import os
import sys
import json
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

try:
    from sqlalchemy import create_engine, inspect, text, Column, Integer, String, Boolean, Float, DateTime, Text, ForeignKey
    from sqlalchemy.orm import sessionmaker, declarative_base, relationship
except ImportError:
    print("SQLAlchemy is required. Install with: pip install sqlalchemy")
    sys.exit(1)

def run_verification(database_url=None):
    if not database_url:
        database_url = os.environ.get("DATABASE_URL")

    if not database_url:
        print("[ERROR] DATABASE_URL is not set in environment or provided as argument.")
        print("Usage: python verify_production_postgres.py <DATABASE_URL>")
        sys.exit(1)

    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    import re
    sanitized_url = re.sub(r':([^@]+)@', ':****@', database_url)
    print(f"==================================================")
    print(f" SA K A N - PRODUCTION POSTGRES VERIFICATION TOOL")
    print(f" Target Database: {sanitized_url}")
    print(f" Timestamp: {datetime.now().isoformat()}")
    print(f"==================================================\n")

    engine = create_engine(database_url)
    inspector = inspect(engine)
    dialect_name = engine.dialect.name

    if not dialect_name.startswith("postgres"):
        print(f"[WARNING] Connected database dialect is '{dialect_name}', not PostgreSQL.")

    discrepancies = []
    is_ready = True

    # ----------------------------------------------------
    # 1. VERIFY ACTUAL PRODUCTION SCHEMA
    # ----------------------------------------------------
    print("--- 1. VERIFYING ACTUAL PRODUCTION SCHEMA ---")

    expected_schema = {
        "users": [
            "id", "phone", "name", "account_type", "is_verified", "otp_code",
            "profile_photo_url", "governorates", "offense_count", "is_banned",
            "verified_by_sakan", "terms_accepted_at", "verified_channel",
            "password_hash", "must_change_password", "auth_token", "created_at"
        ],
        "listings": [
            "id", "title", "governorate", "city", "neighborhood", "address",
            "street", "building_number", "apartment_number", "floor", "maps_link",
            "latitude", "longitude", "gender", "available_beds", "price_per_person",
            "room_type", "total_price", "pricing_mode", "room_configurations",
            "amenities", "photo_urls", "video_urls", "description", "tier",
            "status", "view_count", "min_lease_months", "contact_phone",
            "whatsapp_phone", "subscription_expires_at", "advertiser_id",
            "created_at", "updated_at", "source", "full_edit_available",
            "edit_token", "cover_photo_index", "location_precise",
            "not_vacant_reports", "near_university", "near_transit"
        ],
        "ratings": [
            "id", "listing_id", "student_id", "target_type", "star_count",
            "review_text", "is_verified", "photo_urls", "created_at"
        ],
        "complaints": [
            "id", "listing_id", "student_id", "advertiser_id", "violation_type",
            "description", "evidence_urls", "status", "actioned_at", "created_at"
        ],
        "governorates": ["id", "name", "status"],
        "waitlist_entries": [
            "id", "phone", "name", "governorate_id", "city", "work_volume_range",
            "verified_channel", "signup_at", "tier"
        ],
        "bookmarks": ["id", "user_id", "listing_id", "created_at"],
        "advertiser_messages": [
            "id", "recipient_id", "sender_id", "msg_type", "title", "body",
            "is_read", "created_at"
        ]
    }

    existing_tables = inspector.get_table_names()
    print(f"Existing tables in PostgreSQL: {existing_tables}")

    missing_columns = {}
    for table_name, expected_cols in expected_schema.items():
        if table_name not in existing_tables:
            print(f"[MISSING TABLE] Table '{table_name}' does NOT exist in production PostgreSQL database!")
            missing_columns[table_name] = expected_cols
            is_ready = False
        else:
            actual_cols = {col["name"]: col for col in inspector.get_columns(table_name)}
            missing_in_table = [c for c in expected_cols if c not in actual_cols]
            if missing_in_table:
                print(f"[MISSING COLUMNS] Table '{table_name}' missing columns: {missing_in_table}")
                missing_columns[table_name] = missing_in_table
                is_ready = False
            else:
                print(f"[OK] Table '{table_name}' contains all {len(expected_cols)} expected columns.")

    # ----------------------------------------------------
    # 2. VERIFY POSTGRESQL SEQUENCES
    # ----------------------------------------------------
    print("\n--- 2. VERIFYING POSTGRESQL SEQUENCES ---")

    sequence_status = {}
    with engine.connect() as conn:
        for table_name in ["listings", "users", "ratings", "complaints", "bookmarks", "advertiser_messages", "governorates", "waitlist_entries"]:
            if table_name in existing_tables:
                # Query MAX(id)
                max_id_res = conn.execute(text(f'SELECT MAX(id) FROM "{table_name}"')).fetchone()
                max_id = max_id_res[0] if max_id_res and max_id_res[0] is not None else 0

                # Query sequence value
                seq_name = f"{table_name}_id_seq"
                try:
                    seq_res = conn.execute(text(f"SELECT last_value, is_called FROM {seq_name}")).fetchone()
                    if seq_res:
                        last_val, is_called = seq_res[0], seq_res[1]
                        if not is_called:
                            next_val = last_val
                        else:
                            next_val = last_val + 1
                    else:
                        last_val, next_val = "UNKNOWN", "UNKNOWN"
                except Exception as e:
                    # Fallback using pg_sequences
                    try:
                        seq_res = conn.execute(text(f"SELECT last_value FROM pg_sequences WHERE sequencename = '{seq_name}'")).fetchone()
                        last_val = seq_res[0] if seq_res else "UNKNOWN"
                        next_val = last_val + 1 if isinstance(last_val, int) else "UNKNOWN"
                    except Exception:
                        last_val, next_val = "NOT_FOUND", "NOT_FOUND"

                is_safe = isinstance(next_val, int) and (next_val > max_id or (max_id == 0 and next_val >= 1))
                sequence_status[table_name] = {
                    "max_id": max_id,
                    "last_value": last_val,
                    "next_id": next_val,
                    "is_safe": is_safe
                }

                status_str = "SAFE" if is_safe else "UNSAFE / MISALIGNED"
                print(f"Sequence '{seq_name}': MAX(id)={max_id}, LastValue={last_val}, NextGeneratedID={next_val} -> [{status_str}]")

                if not is_safe:
                    is_ready = False

    # ----------------------------------------------------
    # 3. VERIFY FOREIGN KEYS & ORPHANED RECORDS
    # ----------------------------------------------------
    print("\n--- 3. VERIFYING ADVERTISER FOREIGN KEYS ---")

    orphaned_count = 0
    orphaned_listings = []
    with engine.connect() as conn:
        if "listings" in existing_tables and "users" in existing_tables:
            orphans_res = conn.execute(text("""
                SELECT id, advertiser_id, contact_phone, whatsapp_phone 
                FROM listings 
                WHERE advertiser_id NOT IN (SELECT id FROM users)
            """)).fetchall()

            orphaned_count = len(orphans_res)
            for row in orphans_res:
                orphaned_listings.append({
                    "listing_id": row[0],
                    "advertiser_id": row[1],
                    "contact_phone": row[2],
                    "whatsapp_phone": row[3]
                })

            if orphaned_count == 0:
                print("[OK] Zero orphaned listings.id -> users.id relationships found.")
            else:
                print(f"[WARNING] Found {orphaned_count} orphaned listings referencing non-existent users!")
                for o in orphaned_listings:
                    print(f"  Orphaned Listing #{o['listing_id']} -> advertiser_id={o['advertiser_id']} (Contact: {o['contact_phone']}, WA: {o['whatsapp_phone']})")

    # ----------------------------------------------------
    # 4. VERIFY NEW LISTING CREATION (TEST INSERT & ROLLBACK)
    # ----------------------------------------------------
    print("\n--- 4. VERIFYING NEW LISTING CREATION ---")

    insert_success = False
    generated_id = None
    try:
        with engine.begin() as conn:
            # Fetch a valid user ID for advertiser_id
            user_res = conn.execute(text("SELECT id FROM users LIMIT 1")).fetchone()
            adv_id = user_res[0] if user_res else 1

            # Perform a test insert
            res = conn.execute(text("""
                INSERT INTO listings (
                    title, governorate, city, neighborhood, address, gender, available_beds,
                    advertiser_id, near_university, near_transit, total_price, pricing_mode,
                    location_precise, full_edit_available, created_at, updated_at
                ) VALUES (
                    'Test Verification Listing', 'أسيوط', 'أسيوط', 'حي الجامعة', 'شارع الجامعة',
                    'male', 2, :adv_id, true, false, 1500.0, 'room_based', false, false, NOW(), NOW()
                ) RETURNING id
            """), {"adv_id": adv_id})

            generated_id = res.fetchone()[0]
            print(f"[OK] New listing inserted successfully with generated Primary Key ID: {generated_id}")

            # Verify retrieval via SELECT
            select_res = conn.execute(text("SELECT title, total_price, near_university FROM listings WHERE id = :id"), {"id": generated_id}).fetchone()
            if select_res and select_res[0] == 'Test Verification Listing':
                print(f"[OK] Newly inserted listing #{generated_id} retrieved successfully: {dict(select_res._mapping)}")
                insert_success = True
            else:
                print(f"[FAIL] Inserted listing #{generated_id} could not be retrieved!")

            # Clean up test row so production data is not polluted
            conn.execute(text("DELETE FROM listings WHERE id = :id"), {"id": generated_id})
            print(f"[CLEANUP] Deleted test verification listing #{generated_id}.")
    except Exception as e:
        print(f"[FAIL] Test listing creation failed: {e}")
        insert_success = False
        is_ready = False

    # ----------------------------------------------------
    # 5. VERIFY EXISTING LISTING READS
    # ----------------------------------------------------
    print("\n--- 5. VERIFYING EXISTING LISTING READS ---")

    reads_success = False
    try:
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT id, title, governorate, city, near_university, near_transit, total_price, pricing_mode
                FROM listings
                ORDER BY created_at DESC
                LIMIT 5
            """)).fetchall()

            print(f"[OK] Fetched {len(rows)} existing listings without UndefinedColumn errors.")
            for r in rows:
                print(f"  Listing #{r[0]}: Title='{r[1]}', Gov='{r[2]}', NearUniv={r[4]}, TotalPrice={r[6]}, Mode='{r[7]}'")
            reads_success = True
    except Exception as e:
        print(f"[FAIL] Fetching existing listings failed: {e}")
        reads_success = False
        is_ready = False

    # ----------------------------------------------------
    # 6. VERIFY APPLICATION STARTUP SCHEMA ALIGNMENT
    # ----------------------------------------------------
    print("\n--- 6. VERIFYING STARTUP SCHEMA EXECUTION ---")
    startup_success = True
    try:
        from app.main import ensure_schema
        # Test calling ensure_schema against this engine connection
        print("[INFO] Running ensure_schema() against database connection...")
        ensure_schema()
        print("[OK] ensure_schema() completed without throwing errors.")
    except Exception as e:
        print(f"[FAIL] ensure_schema() raised an error: {e}")
        startup_success = False
        is_ready = False

    # ----------------------------------------------------
    # FINAL SUMMARY REPORT & VERDICT
    # ----------------------------------------------------
    print("\n==================================================")
    print(" VERIFICATION SUMMARY REPORT")
    print("==================================================")
    print(f" Missing Columns: {missing_columns if missing_columns else 'NONE'}")
    print(f" Primary Keys & Sequence Status: {'ALL SAFE' if all(s['is_safe'] for s in sequence_status.values()) else 'MISALIGNED'}")
    print(f" Orphaned Advertiser Records: {orphaned_count}")
    print(f" New Listing Creation Test: {'PASSED (ID: ' + str(generated_id) + ')' if insert_success else 'FAILED'}")
    print(f" Existing Listing Reads Test: {'PASSED' if reads_success else 'FAILED'}")
    print(f" Startup Execution Test: {'PASSED' if startup_success else 'FAILED'}")
    print("==================================================")

    final_verdict = "READY" if (is_ready and insert_success and reads_success and startup_success and not missing_columns) else "NOT READY"
    print(f"\nFINAL VERDICT: {final_verdict}\n")

    return {
        "verdict": final_verdict,
        "missing_columns": missing_columns,
        "sequences": sequence_status,
        "orphaned_count": orphaned_count,
        "orphaned_listings": orphaned_listings,
        "insert_success": insert_success,
        "reads_success": reads_success,
        "startup_success": startup_success
    }

if __name__ == "__main__":
    if len(sys.argv) > 1:
        run_verification(sys.argv[1])
    else:
        run_verification()
