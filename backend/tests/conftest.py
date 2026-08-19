"""
conftest.py – Pytest configuration for Sakan backend tests.

CRITICAL: All tests MUST use an isolated in-memory SQLite database.
This prevents tests from corrupting the live sakan.db used by the uvicorn server.
"""
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# ── Import the app module so we can monkey-patch it ──────────────────────────
import app.main as main_module
from app.main import Base

# ── Create a single in-memory engine shared across all test sessions ─────────
#    StaticPool keeps the same connection for every call (required for :memory:)
TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TEST_SESSION_LOCAL = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)


@pytest.fixture(autouse=True, scope="function")
def isolated_test_db():
    """
    Before each test  → patch the app's engine + SessionLocal to point to
                         the in-memory DB, then create all tables fresh.
    After  each test  → drop all tables so next test starts clean.
    The live sakan.db is NEVER touched.
    """
    # Patch engine & session factory inside the app module
    main_module.engine = TEST_ENGINE
    main_module.SessionLocal = TEST_SESSION_LOCAL
    main_module.IS_TESTING = True


    # Create all tables
    Base.metadata.create_all(bind=TEST_ENGINE)

    yield

    # Tear down — drop all tables cleanly
    Base.metadata.drop_all(bind=TEST_ENGINE)
