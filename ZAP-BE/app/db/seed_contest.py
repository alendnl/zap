"""CLI seed script to populate curated sample contest into MongoDB Atlas (or local/QA database).

Usage:
    python -m app.db.seed_contest [--env production|qa|all] [--force]
"""
import argparse
import logging
from app.db.mongodb import get_database_for_env, ensure_indexes
from app.contests.service import ContestService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("zap_contest_seed")


def seed_contest_for_env(env: str, force: bool = False):
    logger.info(f"Connecting to database for environment: '{env}'...")
    db = get_database_for_env(env)
    if db is None:
        logger.error(f"Failed to connect to database for '{env}'")
        return False

    ensure_indexes(db)
    service = ContestService(db)
    contest = service.seed_sample_contest(force=force)
    if contest:
        logger.info(f"[{env}] Successfully seeded contest '{contest.title}' ({contest.slug})")
    return True


def main():
    parser = argparse.ArgumentParser(description="Seed sample contest into MongoDB.")
    parser.add_argument(
        "--env",
        choices=["production", "qa", "all"],
        default="all",
        help="Target runtime environment (default: all)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force overwrite existing contest with fresh seed data",
    )
    args = parser.parse_args()

    envs = ["production", "qa"] if args.env == "all" else [args.env]
    for env in envs:
        seed_contest_for_env(env, force=args.force)


if __name__ == "__main__":
    main()
