import os
import sys
import json
from datetime import datetime
from pathlib import Path

# Add app path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

try:
    from sqlalchemy import create_engine, inspect, text
except ImportError:
    print("SQLAlchemy is required. Install with: pip install sqlalchemy")
    sys.exit(1)

def datetime_serializer(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

def backup_database(output_filename=None):
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        print(f"[INFO] Connecting to Live PostgreSQL Database...")
    else:
        db_file = BASE_DIR / "sakan.db"
        database_url = f"sqlite:///{db_file}"
        print(f"[INFO] DATABASE_URL not set in environment. Falling back to local SQLite: {db_file}")

    engine = create_engine(database_url)
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    if not output_filename:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"sakan_database_backup_{timestamp}.json"

    output_path = BASE_DIR / output_filename

    backup_data = {
        "metadata": {
            "created_at": datetime.now().isoformat(),
            "database_url_type": "postgresql" if "postgresql" in database_url else "sqlite",
            "tables_count": len(tables)
        },
        "tables": {}
    }

    with engine.connect() as conn:
        for table in tables:
            print(f"[BACKUP] Dumping table '{table}'...")
            result = conn.execute(text(f'SELECT * FROM "{table}"'))
            columns = result.keys()
            rows = [dict(zip(columns, row)) for row in result.fetchall()]
            backup_data["tables"][table] = rows
            print(f"         -> Dumped {len(rows)} rows from '{table}'.")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(backup_data, f, ensure_ascii=False, indent=2, default=datetime_serializer)

    print(f"\n[SUCCESS] Live database backup saved to:\n  {output_path.resolve()}")
    return output_path

if __name__ == "__main__":
    backup_database()
