#!/usr/bin/env python3
"""Sync configured questions from production DB to lower DB.

This satisfies Step 1 of the load test:
Copies the configured question IDs from `zap_platform_prod` to `zap_platform_lower`.

Usage:
    .venv/bin/python load_test/sync_questions.py
"""
import os
import sys
import json
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient

LOAD_TEST_DIR = Path(__file__).resolve().parent
REPO_ROOT = LOAD_TEST_DIR.parent
CONFIG_PATH = LOAD_TEST_DIR / "config.json"

load_dotenv(REPO_ROOT / ".env")


def sync_questions():
    if not CONFIG_PATH.exists():
        print(f"FATAL: Config file not found at {CONFIG_PATH}", file=sys.stderr)
        sys.exit(1)

    with open(CONFIG_PATH, "r") as f:
        config = json.load(f)

    target_db_name = config.get("lower_db_name", "zap_platform_lower")
    source_db_name = config.get("prod_db_name", "zap_platform_prod")
    question_ids = config.get("question_ids", [])

    # Guardrails
    if target_db_name != "zap_platform_lower":
        print(f"FATAL: Target DB must strictly be 'zap_platform_lower'. Found '{target_db_name}'!", file=sys.stderr)
        sys.exit(1)

    if "prod" in target_db_name.lower():
        print("FATAL: Target DB name contains 'prod'!", file=sys.stderr)
        sys.exit(1)

    if not question_ids:
        print("FATAL: No question_ids specified in config.json!", file=sys.stderr)
        sys.exit(1)

    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        print("FATAL: MONGO_URI not found in environment or .env file!", file=sys.stderr)
        sys.exit(1)

    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=8000)
    try:
        client.admin.command("ping")
    except Exception as err:
        print(f"FATAL: Could not connect to MongoDB: {err}", file=sys.stderr)
        sys.exit(1)

    prod_db = client[source_db_name]
    lower_db = client[target_db_name]

    print("=" * 60)
    print(f" SYNCING QUESTIONS: '{source_db_name}' ➔ '{target_db_name}'")
    print(f" Configured IDs: {question_ids}")
    print("=" * 60)

    synced_count = 0
    missing = []

    for q_id in question_ids:
        doc = prod_db.questions.find_one({"$or": [{"id": q_id}, {"_id": q_id}, {"slug": q_id}]})
        if not doc:
            missing.append(q_id)
            print(f"  ❌ Not found in prod: {q_id}")
            continue

        canonical_id = doc.get("id") or str(doc.get("_id"))
        doc["id"] = canonical_id
        # Upsert into lower DB
        lower_db.questions.replace_one({"id": canonical_id}, doc, upsert=True)
        synced_count += 1
        print(f"  ✓ Copied: [{canonical_id}] '{doc.get('title')}' (slug: {doc.get('slug')})")

    print(f"\n✓ Successfully synced {synced_count}/{len(question_ids)} questions into '{target_db_name}'.")
    if missing:
        print(f"⚠ Warning: {len(missing)} questions were not found: {missing}")

    return synced_count


if __name__ == "__main__":
    sync_questions()
