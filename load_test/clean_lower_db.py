#!/usr/bin/env python3
"""Script to clean all data in the lower environment database (zap_platform_lower).

Safety Guardrails:
- Hard-locked to target ONLY 'zap_platform_lower'.
- Aborts if the database name is missing or contains 'prod'.
- Displays document counts before and after deletion.
- Supports interactive confirmation or --force flag.

Usage:
    .venv/bin/python load_test/clean_lower_db.py [--force]
"""
import os
import sys
import argparse
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient

# Load root .env
REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(REPO_ROOT / ".env")

TARGET_DB = "zap_platform_lower"
COLLECTIONS_TO_CLEAN = ["users", "submissions", "user_activities", "questions"]


def ensure_lower_indexes(db):
    """Recreate required indexes so future queries remain performant."""
    indexes = [
        ("submissions", [("userId", 1), ("createdAt", -1)], {}),
        ("submissions", [("questionId", 1), ("createdAt", -1)], {}),
        ("submissions", [("userId", 1), ("questionId", 1), ("createdAt", -1)], {}),
        ("user_activities", [("userId", 1)], {"unique": True}),
        ("user_activities", [("updatedAt", -1)], {}),
        ("users", [("email", 1)], {"unique": True}),
        ("users", [("studentId", 1)], {}),
        ("questions", [("slug", 1)], {"unique": True}),
        ("questions", [("status", 1)], {}),
    ]
    for coll_name, keys, kwargs in indexes:
        try:
            db[coll_name].create_index(keys, **kwargs)
        except Exception:
            pass
    print("  ✓ Ensured indexes for all collections.")


def main():
    parser = argparse.ArgumentParser(description="Clean all data in zap_platform_lower DB.")
    parser.add_argument("--force", action="store_true", help="Skip confirmation prompt")
    parser.add_argument("--mongo-uri", default=os.getenv("MONGO_URI"), help="MongoDB URI")
    args = parser.parse_args()

    # Safety Guardrails
    if not TARGET_DB or TARGET_DB != "zap_platform_lower":
        print(f"FATAL: Target DB must strictly be 'zap_platform_lower'. Found '{TARGET_DB}'!", file=sys.stderr)
        sys.exit(1)

    if "prod" in TARGET_DB.lower():
        print("FATAL: Target DB name contains 'prod'! Operation aborted for safety.", file=sys.stderr)
        sys.exit(1)

    if not args.mongo_uri:
        print("FATAL: MONGO_URI not found in environment or .env file!", file=sys.stderr)
        sys.exit(1)

    client = MongoClient(args.mongo_uri, serverSelectionTimeoutMS=8000)
    try:
        client.admin.command("ping")
    except Exception as err:
        print(f"FATAL: Could not connect to MongoDB: {err}", file=sys.stderr)
        sys.exit(1)

    db = client[TARGET_DB]
    print("=" * 60)
    print(f" TARGET DATABASE: {TARGET_DB}")
    print("=" * 60)

    print("\nCurrent document counts:")
    counts = {}
    for coll_name in COLLECTIONS_TO_CLEAN:
        cnt = db[coll_name].count_documents({})
        counts[coll_name] = cnt
        print(f"  • {coll_name}: {cnt} documents")

    total_docs = sum(counts.values())
    if total_docs == 0:
        print("\nDatabase is already clean. Nothing to delete.")
        ensure_lower_indexes(db)
        return

    if not args.force:
        print("\n" + "!" * 60)
        print(" WARNING: This will permanently delete ALL documents in:")
        print(f"          Database: '{TARGET_DB}'")
        print(f"          Collections: {', '.join(COLLECTIONS_TO_CLEAN)}")
        print("!" * 60)
        try:
            confirm = input("\nType 'clean-lower' to proceed: ").strip()
            if confirm != "clean-lower":
                print("Aborted by user.")
                sys.exit(0)
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            sys.exit(0)

    print("\nDeleting documents...")
    for coll_name in COLLECTIONS_TO_CLEAN:
        res = db[coll_name].delete_many({})
        print(f"  ✓ Deleted {res.deleted_count} documents from '{coll_name}'.")

    ensure_lower_indexes(db)

    print("\nVerification:")
    for coll_name in COLLECTIONS_TO_CLEAN:
        rem = db[coll_name].count_documents({})
        print(f"  • {coll_name}: {rem} documents remaining")

    print("\n✓ zap_platform_lower cleaned successfully!")


if __name__ == "__main__":
    main()
