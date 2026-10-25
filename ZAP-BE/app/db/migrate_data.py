"""Idempotent database migration and data normalization script.

Usage:
    python -m app.db.migrate_data [--env production|qa|all] [--dry-run]

What it does:
1. Ensures all required indexes on `submissions`, `user_activities`, `users`, and `questions`.
2. Standardizes user references in `submissions`: maps studentId / roll number to the user's canonical UUID id.
3. Denormalizes `userEmail` into `submissions` for fast auditing without joins.
4. Backfills the `user_activities` collection (one document per user) by replaying existing submissions.
"""
import sys
import argparse
import logging
from typing import Dict, Any, List

from app.config import get_settings
from app.db.mongodb import get_database_for_env, ensure_indexes
from app.activity.service import ActivityService
from app.submissions.models import Submission

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("zap_migration")


def apply_submission_updates(coll, pending_updates):
    if not pending_updates or coll is None:
        return
    try:
        from pymongo import UpdateOne
        ops = [UpdateOne({"_id": sid}, {"$set": up}) for sid, up in pending_updates]
        coll.bulk_write(ops, ordered=False)
    except Exception:
        for sid, up in pending_updates:
            coll.update_one({"$or": [{"_id": sid}, {"id": sid}]}, {"$set": up})


def apply_activity_replacements(coll, pending_replaces):
    if not pending_replaces or coll is None:
        return
    try:
        from pymongo import ReplaceOne
        ops = [ReplaceOne({"userId": uid}, doc, upsert=True) for uid, doc in pending_replaces]
        coll.bulk_write(ops, ordered=False)
    except Exception:
        for uid, doc in pending_replaces:
            coll.replace_one({"$or": [{"userId": uid}, {"_id": uid}]}, doc, upsert=True)


def migrate_environment(env: str, dry_run: bool = False) -> Dict[str, Any]:
    logger.info(f"--- Starting migration for environment: '{env}' (dry_run={dry_run}) ---")
    db = get_database_for_env(env)
    if db is None:
        logger.error(f"Could not connect to database for environment '{env}'")
        return {"status": "error", "message": "database unavailable"}

    stats = {
        "env": env,
        "indexes_ensured": False,
        "users_found": 0,
        "submissions_scanned": 0,
        "submissions_updated": 0,
        "activities_populated": 0,
    }

    # 1. Ensure indexes
    if not dry_run:
        ensure_indexes(db)
        stats["indexes_ensured"] = True
        logger.info("Collection indexes ensured.")

    # 2. Build user lookup table
    user_by_student_id: Dict[str, Dict[str, Any]] = {}
    user_by_email: Dict[str, Dict[str, Any]] = {}
    user_by_id: Dict[str, Dict[str, Any]] = {}

    users_coll = getattr(db, "users", None)
    if users_coll is not None:
        try:
            for u in users_coll.find({}):
                uid = str(u.get("id") or u.get("_id"))
                stats["users_found"] += 1
                user_by_id[uid] = u
                if u.get("studentId"):
                    user_by_student_id[str(u["studentId"]).strip()] = u
                if u.get("email"):
                    user_by_email[str(u["email"]).strip().lower()] = u
        except Exception as exc:
            logger.warning(f"Could not scan users collection: {exc}")

    logger.info(f"Loaded {stats['users_found']} users into lookup cache.")

    # 3. Migrate submissions
    submissions_coll = getattr(db, "submissions", None)
    if submissions_coll is not None:
        try:
            cursor = submissions_coll.find({})
            pending_updates = []
            for sub_doc in cursor:
                stats["submissions_scanned"] += 1
                sub_id = sub_doc.get("id") or sub_doc.get("_id")
                current_user_id = str(sub_doc.get("userId", ""))
                current_email = sub_doc.get("userEmail")

                resolved_user_id = current_user_id
                resolved_email = current_email

                matched_user = None
                if current_user_id in user_by_student_id:
                    matched_user = user_by_student_id[current_user_id]
                elif current_user_id.lower() in user_by_email:
                    matched_user = user_by_email[current_user_id.lower()]
                elif current_user_id in user_by_id:
                    matched_user = user_by_id[current_user_id]

                if matched_user:
                    resolved_user_id = str(matched_user.get("id") or matched_user.get("_id"))
                    resolved_email = matched_user.get("email")

                updates = {}
                if resolved_user_id != current_user_id:
                    updates["userId"] = resolved_user_id
                if resolved_email and resolved_email != current_email:
                    updates["userEmail"] = resolved_email

                if updates:
                    stats["submissions_updated"] += 1
                    if not dry_run:
                        pending_updates.append((sub_id, updates))
                        if len(pending_updates) >= 500:
                            apply_submission_updates(submissions_coll, pending_updates)
                            pending_updates = []

            if not dry_run and pending_updates:
                apply_submission_updates(submissions_coll, pending_updates)
        except Exception as exc:
            logger.warning(f"Error scanning submissions: {exc}")

    logger.info(f"Submissions scanned: {stats['submissions_scanned']}, updated: {stats['submissions_updated']}")

    # 4. Backfill user_activities
    if not dry_run and submissions_coll is not None:
        act_coll = getattr(db, "user_activities", None)
        distinct_users = set()
        try:
            for s in submissions_coll.find({}, {"userId": 1, "_id": 0}):
                uid = s.get("userId")
                if uid:
                    distinct_users.add(uid)
        except Exception:
            pass

        for uid in user_by_id.keys():
            distinct_users.add(uid)

        logger.info(f"Replaying submissions to backfill activities for {len(distinct_users)} users...")
        pending_replaces = []
        for uid in distinct_users:
            user_subs = list(submissions_coll.find({"userId": uid}).sort("createdAt", 1))
            mem_act_service = ActivityService(None)
            for raw_sub in user_subs:
                raw_sub.pop("_id", None)
                try:
                    sub_obj = Submission(**raw_sub)
                    mem_act_service.record_submission(sub_obj)
                except Exception as parse_exc:
                    logger.debug(f"Skipping unparseable submission {raw_sub.get('id')}: {parse_exc}")

            final_activity = mem_act_service.get_activity(uid)
            doc = final_activity.model_dump()
            doc["_id"] = uid
            pending_replaces.append((uid, doc))
            stats["activities_populated"] += 1

        apply_activity_replacements(act_coll, pending_replaces)
        logger.info(f"Successfully populated {stats['activities_populated']} user activity documents.")

    logger.info(f"Finished migration for environment '{env}'.")
    return stats


def main():
    parser = argparse.ArgumentParser(description="ZAP Database Migration Tool")
    parser.add_argument("--env", choices=["production", "qa", "all"], default="all", help="Target environment")
    parser.add_argument("--dry-run", action="store_true", help="Inspect changes without writing to DB")
    args = parser.parse_args()

    envs: List[str] = ["production", "qa"] if args.env == "all" else [args.env]
    results = {}
    for env in envs:
        results[env] = migrate_environment(env, dry_run=args.dry_run)

    print("\n=== Migration Results Summary ===")
    for env, res in results.items():
        print(f"Env: {env} -> {res}")


if __name__ == "__main__":
    main()
