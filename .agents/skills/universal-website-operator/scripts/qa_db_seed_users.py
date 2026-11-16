#!/usr/bin/env python3
"""
QA Database User Seeder & Test Credential Manager
Universal Website Interaction Skill - ZAP Platform

SAFETY ENFORCEMENT:
- Operates EXCLUSIVELY against the lower / QA database: 'zap_platform_lower'.
- Hard-coded assertion prevents any write operation to 'zap_platform_prod'.
- Creates:
  1. Regular Student Test User (qa.student@codezap.in / QAPassword123!)
  2. Admin / Faculty Test User (qa.admin@codezap.in / QAAdminPass123!)
"""

import os
import sys
import uuid
import hashlib
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any

# Ensure ZAP-BE is in path for configuration & hashing compatibility
REPO_ROOT = Path(__file__).resolve().parents[4]
if not (REPO_ROOT / ".env").exists():
    # Fallback to current working directory or finding .env
    curr = Path.cwd()
    if (curr / ".env").exists():
        REPO_ROOT = curr
sys.path.insert(0, str(REPO_ROOT / "ZAP-BE"))

from pymongo import MongoClient

# Strict safety target
QA_DATABASE_NAME = "zap_platform_lower"
PROD_DATABASE_NAME = "zap_platform_prod"

TEST_STUDENT_USER = {
    "id": "std-qa-student-001",
    "name": "QA Test Student",
    "studentId": "QA-STU-001",
    "collegeName": "ZAP QA Testing College",
    "email": "qa.student@codezap.in",
    "password": "QAPassword123!",
    "role": "student"
}

TEST_ADMIN_USER = {
    "id": "std-qa-admin-001",
    "name": "QA Test Admin",
    "studentId": "QA-ADM-001",
    "collegeName": "ZAP QA Faculty & Admin",
    "email": "qa.admin@codezap.in",
    "password": "QAAdminPass123!",
    "role": "admin"
}


def hash_password(password: str) -> str:
    """PBKDF2-HMAC-SHA256 password hashing matching ZAP-BE AuthService."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 100000).hex()
    return f"{salt}:{key}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify password against stored PBKDF2 hash."""
    try:
        parts = stored_hash.split(":")
        if len(parts) != 2:
            return False
        salt, key = parts
        calc_key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 100000).hex()
        return secrets.compare_digest(calc_key, key)
    except Exception:
        return False


def get_qa_database():
    """Connect to MongoDB Atlas and return ONLY the QA database."""
    # Read MONGO_URI from environment or .env
    mongo_uri = os.environ.get("MONGO_URI") or os.environ.get("MONGODB_URI")
    if not mongo_uri:
        env_file = REPO_ROOT / ".env"
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                if line.startswith("MONGO_URI=") or line.startswith("MONGODB_URI="):
                    mongo_uri = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break

    if not mongo_uri:
        raise RuntimeError("No MONGO_URI found in environment or .env file.")

    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    db = client[QA_DATABASE_NAME]

    # Non-negotiable safety assertion
    assert db.name == QA_DATABASE_NAME, f"CRITICAL SAFETY VIOLATION: Database name '{db.name}' is not '{QA_DATABASE_NAME}'!"
    assert db.name != PROD_DATABASE_NAME, f"CRITICAL SAFETY VIOLATION: Refusing to operate on production database '{db.name}'!"

    return db


def seed_qa_users(force: bool = False):
    """Seed or update normal test user and admin test user in zap_platform_lower."""
    db = get_qa_database()
    print(f"🔒 Connected to Target Database: '{db.name}' (STRICT QA ONLY)")

    # Ensure indexes
    db.users.create_index([("email", 1)], unique=True)
    db.users.create_index([("studentId", 1)])
    db.admin.create_index([("email", 1)], unique=True)

    users_to_seed = [TEST_STUDENT_USER, TEST_ADMIN_USER]
    now = datetime.now(timezone.utc).isoformat()

    for u in users_to_seed:
        email = u["email"].lower().strip()
        existing = db.users.find_one({"email": email})

        pwd_hash = hash_password(u["password"])
        doc = {
            "id": u["id"],
            "name": u["name"],
            "studentId": u["studentId"],
            "collegeName": u["collegeName"],
            "email": email,
            "passwordHash": pwd_hash,
            "createdAt": existing.get("createdAt", now) if existing else now,
            "updatedAt": now,
        }

        if existing:
            db.users.update_one({"email": email}, {"$set": doc})
            print(f"✓ Updated test user in users collection: {email} (Role: {u['role']})")
        else:
            doc["_id"] = u["id"]
            db.users.insert_one(doc)
            print(f"✓ Created test user in users collection: {email} (Role: {u['role']})")

    # Admin Collection for Role-Gated Admin Access
    admin_email = TEST_ADMIN_USER["email"].lower().strip()
    admin_existing = db.admin.find_one({"email": admin_email})
    if not admin_existing:
        db.admin.insert_one({
            "_id": "adm-qa-admin-001",
            "email": admin_email,
            "createdAt": now
        })
        print(f"✓ Added admin authorization record to admin collection: {admin_email}")
    else:
        print(f"✓ Admin authorization record already present in admin collection: {admin_email}")

    print("\n✅ QA Database Test Users Setup Complete!")
    print_credentials()


def print_credentials():
    """Print the active QA credentials for copy-paste and browser automation."""
    print("=" * 65)
    print(" 🧪 ZAP QA DATABASE TEST CREDENTIALS (LOWER DB ONLY)")
    print("=" * 65)
    print(f" Target Database:   {QA_DATABASE_NAME}")
    print(f" Runtime Header:    X-ZAP-ENV: qa")
    print(f" Environment Local: zap.environment = 'qa'")
    print("-" * 65)
    print(" 1. REGULAR STUDENT TEST USER (Standard DSA / Contest Arena):")
    print(f"    - Email:        {TEST_STUDENT_USER['email']}")
    print(f"    - Student ID:   {TEST_STUDENT_USER['studentId']}")
    print(f"    - Password:     {TEST_STUDENT_USER['password']}")
    print(f"    - Name:         {TEST_STUDENT_USER['name']}")
    print(f"    - College:      {TEST_STUDENT_USER['collegeName']}")
    print(f"    - Permissions:  Student Portal, Questions, Compiler, Contests")
    print("-" * 65)
    print(" 2. ADMIN & FACULTY TEST USER (Admin Hub / Problem Authoring):")
    print(f"    - Email:        {TEST_ADMIN_USER['email']}")
    print(f"    - Student ID:   {TEST_ADMIN_USER['studentId']}")
    print(f"    - Password:     {TEST_ADMIN_USER['password']}")
    print(f"    - Name:         {TEST_ADMIN_USER['name']}")
    print(f"    - Permissions:  Admin Hub, User Stats, Studio, MCQ & Question Authoring")
    print("=" * 65)


def verify_qa_users():
    """Check existence and verify password hashes of test users in QA DB."""
    db = get_qa_database()
    print(f"🔍 Checking QA Database: '{db.name}'")

    for u in [TEST_STUDENT_USER, TEST_ADMIN_USER]:
        email = u["email"].lower().strip()
        doc = db.users.find_one({"email": email})
        if not doc:
            print(f"❌ Missing user in QA DB: {email}")
            continue

        valid = verify_password(u["password"], doc.get("passwordHash", ""))
        status_icon = "✅" if valid else "❌"
        print(f"{status_icon} User '{email}': Document found, password hash verified: {valid}")

    # Check admin collection
    admin_doc = db.admin.find_one({"email": TEST_ADMIN_USER["email"]})
    admin_status = "✅" if admin_doc else "❌"
    print(f"{admin_status} Admin collection check for '{TEST_ADMIN_USER['email']}': {'Authorized' if admin_doc else 'Missing'}")


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "seed"
    if action == "seed":
        seed_qa_users()
    elif action == "verify":
        verify_qa_users()
    elif action == "credentials":
        print_credentials()
    else:
        print("Usage: python3 qa_db_seed_users.py [seed|verify|credentials]")
