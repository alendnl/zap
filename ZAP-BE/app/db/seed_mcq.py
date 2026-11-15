"""CLI seed script to populate curated MCQ questions into MongoDB Atlas (or local/QA database).

Usage:
    python -m app.db.seed_mcq [--env production|qa|all] [--force]
"""
import argparse
import logging
from app.db.mongodb import get_database_for_env, ensure_indexes
from app.mcq.service import MCQService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("zap_mcq_seed")


def seed_mcqs_for_env(env: str, force: bool = False):
    logger.info(f"Connecting to database for environment: '{env}'...")
    db = get_database_for_env(env)
    if db is None:
        logger.error(f"Failed to connect to database for '{env}'")
        return False

    ensure_indexes(db)
    service = MCQService(db)
    result = service.seed_default_questions(force=force)
    logger.info(f"[{env}] Successfully seeded {result['seeded']} MCQ questions (Total in collection: {result['total']})")
    return True


def main():
    parser = argparse.ArgumentParser(description="Seed curated MCQ questions into MongoDB.")
    parser.add_argument(
        "--env",
        choices=["production", "qa", "all"],
        default="all",
        help="Target runtime environment (default: all)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force overwrite existing questions with fresh seed data",
    )
    args = parser.parse_args()

    envs = ["production", "qa"] if args.env == "all" else [args.env]
    for env in envs:
        seed_mcqs_for_env(env, force=args.force)


if __name__ == "__main__":
    main()

