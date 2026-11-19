#!/usr/bin/env python3
"""Unified Project Operations CLI (zap_ops).

Central operational tool for ZAP platform:
1. MongoDB Atlas (production: zap_platform_prod, lower/QA: zap_platform_lower)
2. Google Cloud Platform (Cloud Run, Cloud Tasks, Secret Manager, Cloud Logging)
3. Git & GitHub CI/CD (Workflow runs, deployment statuses, repository metadata)
4. Cross-System Operations (deploy sync verification, logs correlation, data backups/exports)

Usage examples:
    # Full environment doctor / health check:
    python zap_ops.py doctor

    # MongoDB operations:
    python zap_ops.py mongo ping
    python zap_ops.py mongo list --env prod
    python zap_ops.py mongo count
    python zap_ops.py mongo query --env prod -c questions --fields slug,title,difficulty --limit 5
    python zap_ops.py mongo get --env prod -c questions two-sum
    python zap_ops.py mongo schema --env prod -c submissions
    python zap_ops.py mongo aggregate --env prod -c submissions --pipeline '[{"$group": {"_id": "$status", "count": {"$sum": 1}}}]'
    python zap_ops.py mongo export --env prod -c questions -o questions_prod.json
    python zap_ops.py mongo import --env lower -c questions -i questions_prod.json --upsert
    python zap_ops.py mongo backup --env lower -o ./backups/lower_db

    # GCP operations:
    python zap_ops.py gcp services
    python zap_ops.py gcp tasks
    python zap_ops.py gcp logs --service api --severity ERROR --limit 20
    python zap_ops.py gcp secrets
    python zap_ops.py gcp deploy-status

    # GitHub operations:
    python zap_ops.py github runs --limit 5
    python zap_ops.py github view <RUN_ID> --failed-logs
    python zap_ops.py github status
"""

import os
import sys
import csv
import json
import time
import shutil
import argparse
import subprocess
from pathlib import Path
from typing import Any, Optional, Dict, List

# Automatically locate and load .env from repository root
def find_and_load_env():
    current = Path(__file__).resolve()
    for parent in [current] + list(current.parents):
        env_file = parent / ".env"
        if env_file.is_file():
            try:
                from dotenv import load_dotenv
                load_dotenv(env_file)
            except ImportError:
                # Manual fallback if dotenv not installed
                with open(env_file, "r") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            os.environ.setdefault(k.strip(), v.strip().strip("'\""))
            return env_file
    return None

find_and_load_env()

# Project Configuration Constants
DEFAULT_GCP_PROJECT = os.getenv("GCP_PROJECT_ID", "zap-platform-prod")
DEFAULT_GCP_REGION = os.getenv("GCP_LOCATION", "us-central1")
DEFAULT_REPO = "alendnl/zap"

DB_NAMES = {
    "prod": "zap_platform_prod",
    "production": "zap_platform_prod",
    "lower": "zap_platform_lower",
    "qa": "zap_platform_lower",
    "staging": "zap_platform_lower",
}

QUEUE_NAMES = {
    "prod": "zap-submissions",
    "production": "zap-submissions",
    "lower": "zap-submissions",
    "qa": "zap-submissions",
}

# Terminal colors and formatting
class Colors:
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    RESET = "\033[0m"

def c_ok(msg: str) -> str:
    return f"{Colors.GREEN}✓ {msg}{Colors.RESET}"

def c_warn(msg: str) -> str:
    return f"{Colors.YELLOW}⚠ {msg}{Colors.RESET}"

def c_err(msg: str) -> str:
    return f"{Colors.RED}✗ {msg}{Colors.RESET}"

def c_bold(msg: str) -> str:
    return f"{Colors.BOLD}{msg}{Colors.RESET}"

def get_mongo_client(timeout_ms: int = 6000):
    """Retrieve PyMongo client using MONGO_URI with primaryPreferred read preference."""
    uri = os.getenv("MONGO_URI") or os.getenv("MONGODB_URI")
    if not uri:
        raise ValueError(
            "MongoDB URI not found! Please ensure MONGO_URI or MONGODB_URI is set in .env."
        )
    try:
        from pymongo import MongoClient, ReadPreference
        return MongoClient(
            uri,
            serverSelectionTimeoutMS=timeout_ms,
            read_preference=ReadPreference.PRIMARY_PREFERRED
        )
    except ImportError:
        raise RuntimeError("pymongo package not found. Run with .venv/bin/python or install pymongo.")

def resolve_db_name(env: str) -> str:
    env_clean = env.strip().lower()
    return DB_NAMES.get(env_clean, env)

def get_gh_env() -> Dict[str, str]:
    """Prepare environment for gh CLI, injecting GIT_TOKEN as GH_TOKEN if needed."""
    env = os.environ.copy()
    if "GH_TOKEN" not in env and "GITHUB_TOKEN" not in env:
        git_token = os.getenv("GIT_TOKEN")
        if git_token:
            env["GH_TOKEN"] = git_token
    return env

def serialize_mongo_doc(doc: Any) -> Any:
    """Helper to convert MongoDB ObjectIds, datetimes, and nested values for JSON serialization."""
    if isinstance(doc, dict):
        return {k: serialize_mongo_doc(v) for k, v in doc.items()}
    elif isinstance(doc, list):
        return [serialize_mongo_doc(item) for item in doc]
    elif hasattr(doc, "__str__") and type(doc).__name__ in ("ObjectId", "datetime", "UUID"):
        return str(doc)
    return doc


# ==============================================================================
# 1. DOCTOR / UNIFIED STATUS DASHBOARD
# ==============================================================================

def cmd_doctor(args: argparse.Namespace):
    """Run full diagnostic across MongoDB Atlas, GCP Cloud Run/Tasks, and GitHub CI/CD."""
    print(c_bold("\n======================================================="))
    print(c_bold("       ZAP PLATFORM INFRASTRUCTURE & DATA HEALTH       "))
    print(c_bold("=======================================================\n"))

    # 1. MongoDB Check
    print(c_bold("1. MongoDB Atlas:"))
    try:
        client = get_mongo_client(timeout_ms=5000)
        start = time.perf_counter()
        ping_res = client.admin.command("ping")
        elapsed_ms = (time.perf_counter() - start) * 1000
        ok_val = ping_res.get('ok')
        print(f"  {c_ok(f'Connection Ping: {elapsed_ms:.1f}ms (ok={ok_val})')}")

        dbs = client.list_database_names()
        for env_label, db_name in [("Production", "zap_platform_prod"), ("QA/Lower", "zap_platform_lower")]:
            if db_name in dbs:
                db = client[db_name]
                colls = db.list_collection_names()
                total_docs = sum(db[c].count_documents({}) for c in colls)
                print(f"  {c_ok(f'{env_label} ({db_name}): {len(colls)} collections, {total_docs:,} total documents')}")
            else:
                print(f"  {c_warn(f'{env_label} ({db_name}): Database not found on cluster')}")
    except Exception as e:
        print(f"  {c_err(f'MongoDB connection error: {e}')}")

    # 2. GCP Cloud Run & Cloud Tasks Check
    print(c_bold("\n2. Google Cloud Platform (GCP):"))
    gcloud_bin = shutil.which("gcloud")
    if not gcloud_bin:
        print(f"  {c_warn('gcloud CLI not installed or not in PATH')}")
    else:
        project = args.project or DEFAULT_GCP_PROJECT
        region = args.region or DEFAULT_GCP_REGION
        print(f"  Target Project: {project} ({region})")

        # Check Cloud Run Services
        try:
            cmd = [
                gcloud_bin, "run", "services", "list",
                f"--project={project}",
                f"--region={region}",
                "--format=json"
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            if res.returncode == 0:
                services = json.loads(res.stdout)
                for svc in services:
                    name = svc.get("metadata", {}).get("name")
                    url = svc.get("status", {}).get("address", {}).get("url")
                    conditions = svc.get("status", {}).get("conditions", [])
                    ready = any(c.get("type") == "Ready" and c.get("status") == "True" for c in conditions)
                    status_text = c_ok("READY") if ready else c_warn("NOT READY")
                    print(f"  {status_text} Cloud Run '{name}': {url}")
            else:
                print(f"  {c_err(f'Cloud Run query failed: {res.stderr.strip()}')}")
        except Exception as e:
            print(f"  {c_err(f'GCP Cloud Run check error: {e}')}")

        # Check Cloud Tasks Queues
        try:
            cmd = [
                gcloud_bin, "tasks", "queues", "list",
                f"--project={project}",
                f"--location={region}",
                "--format=json"
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            if res.returncode == 0:
                queues = json.loads(res.stdout)
                for q in queues:
                    q_name = q.get("name", "").split("/")[-1]
                    state = q.get("state", "UNKNOWN")
                    q_status = c_ok(state) if state == "RUNNING" else c_warn(state)
                    print(f"  {q_status} Cloud Tasks '{q_name}'")
            else:
                print(f"  {c_err(f'Cloud Tasks query failed: {res.stderr.strip()}')}")
        except Exception as e:
            print(f"  {c_err(f'GCP Cloud Tasks check error: {e}')}")

    # 3. GitHub & CI/CD Check
    print(c_bold("\n3. GitHub CI/CD:"))
    gh_bin = shutil.which("gh")
    if not gh_bin:
        print(f"  {c_warn('gh CLI not installed or not in PATH')}")
    else:
        gh_env = get_gh_env()
        try:
            # Check gh user / auth
            auth_cmd = [gh_bin, "api", "user", "--jq", ".login"]
            auth_res = subprocess.run(auth_cmd, env=gh_env, capture_output=True, text=True, timeout=8)
            if auth_res.returncode == 0:
                user = auth_res.stdout.strip()
                print(f"  {c_ok(f'Authenticated as GitHub user: {user}')}")
            else:
                print(f"  {c_warn('GitHub CLI not authenticated (ensure GIT_TOKEN in .env or run gh auth login)')}")

            # Check latest workflow run
            runs_cmd = [
                gh_bin, "run", "list",
                "--repo", DEFAULT_REPO,
                "--limit", "1",
                "--json", "name,status,conclusion,headBranch,url,updatedAt"
            ]
            runs_res = subprocess.run(runs_cmd, env=gh_env, capture_output=True, text=True, timeout=12)
            if runs_res.returncode == 0 and runs_res.stdout.strip():
                runs = json.loads(runs_res.stdout)
                if runs:
                    r = runs[0]
                    conc = r.get("conclusion") or r.get("status")
                    conc_fmt = c_ok(conc) if conc in ("success", "completed") else c_warn(conc)
                    print(f"  Latest CI: [{conc_fmt}] {r.get('name')} on '{r.get('headBranch')}' ({r.get('url')})")
        except Exception as e:
            print(f"  {c_err(f'GitHub check error: {e}')}")

    print(c_bold("\n=======================================================\n"))


# ==============================================================================
# 2. MONGODB OPERATIONS
# ==============================================================================

def cmd_mongo_ping(args: argparse.Namespace):
    """Test connection, measure latency, and display cluster databases."""
    client = get_mongo_client()
    start = time.perf_counter()
    res = client.admin.command("ping")
    elapsed_ms = (time.perf_counter() - start) * 1000
    server_info = client.server_info()
    version = server_info.get("version", "unknown")
    print(c_ok("Connected to MongoDB Atlas successfully!"))
    print(f"  Latency: {elapsed_ms:.2f}ms")
    print(f"  Server Version: {version}")
    print(f"  Available Databases: {', '.join(client.list_database_names())}")

def cmd_mongo_list(args: argparse.Namespace):
    """List collections, document counts, and index counts for target environment."""
    client = get_mongo_client()
    db_name = resolve_db_name(args.env)
    db = client[db_name]
    colls = sorted(db.list_collection_names())

    print(c_bold(f"\nCollections in '{db_name}' ({len(colls)} total):"))
    print(f"{'Collection':<28} {'Doc Count':>12} {'Indexes':>10}")
    print("-" * 54)
    for c in colls:
        count = db[c].count_documents({})
        idx_count = len(db[c].index_information())
        print(f"{c:<28} {count:>12,} {idx_count:>10}")
    print()

def cmd_mongo_count(args: argparse.Namespace):
    """Compare document counts across prod and lower environments side-by-side."""
    client = get_mongo_client()
    prod_db = client["zap_platform_prod"]
    lower_db = client["zap_platform_lower"]

    colls = sorted(set(prod_db.list_collection_names() + lower_db.list_collection_names()))
    print(c_bold("\nDocument Counts by Collection:"))
    print(f"{'Collection':<28} {'Production':>15} {'Lower (QA)':>15}")
    print("-" * 62)
    for c in colls:
        p_cnt = prod_db[c].count_documents({}) if c in prod_db.list_collection_names() else 0
        l_cnt = lower_db[c].count_documents({}) if c in lower_db.list_collection_names() else 0
        print(f"{c:<28} {p_cnt:>15,} {l_cnt:>15,}")
    print()

def cmd_mongo_query(args: argparse.Namespace):
    """Query documents with filtering, projection, sort, limit, and output formatting."""
    client = get_mongo_client()
    db_name = resolve_db_name(args.env)
    db = client[db_name]
    coll = db[args.collection]

    query_filter = {}
    if args.filter:
        try:
            query_filter = json.loads(args.filter)
        except json.JSONDecodeError as e:
            print(c_err(f"Invalid JSON in --filter: {e}"))
            sys.exit(1)

    projection = None
    if args.fields:
        field_list = [f.strip() for f in args.fields.split(",")]
        projection = {f: 1 for f in field_list}
        if "_id" not in field_list:
            projection["_id"] = 0

    sort_criteria = None
    if args.sort:
        parts = args.sort.split(":")
        field = parts[0].strip()
        direction = -1 if len(parts) > 1 and parts[1].strip() in ("-1", "desc", "DESC") else 1
        sort_criteria = [(field, direction)]

    cursor = coll.find(query_filter, projection)
    if sort_criteria:
        cursor = cursor.sort(sort_criteria)
    cursor = cursor.limit(args.limit)

    results = [serialize_mongo_doc(doc) for doc in cursor]

    if args.format == "table" and results:
        keys = list(results[0].keys())[:6]
        header = " | ".join(f"{k:<18}" for k in keys)
        print(c_bold(f"\n{header}"))
        print("-" * len(header))
        for doc in results:
            row = " | ".join(f"{str(doc.get(k, ''))[:18]:<18}" for k in keys)
            print(row)
        print(f"\n{c_ok(f'Showing {len(results)} records from {db_name}.{args.collection}')}\n")
    else:
        print(json.dumps(results, indent=2, default=str))
        print(f"\n{c_ok(f'Returned {len(results)} documents from {db_name}.{args.collection}')}")

def cmd_mongo_get(args: argparse.Namespace):
    """Get single document by ID, slug, email, or userId."""
    client = get_mongo_client()
    db_name = resolve_db_name(args.env)
    db = client[db_name]
    coll = db[args.collection]

    val = args.identifier
    query = None
    if len(val) == 24:
        try:
            from bson.objectid import ObjectId
            query = {"_id": ObjectId(val)}
        except Exception:
            pass
    if not query:
        query = {"$or": [{"_id": val}, {"id": val}, {"slug": val}, {"userId": val}, {"email": val}]}

    doc = coll.find_one(query)
    if not doc:
        print(c_warn(f"No document found matching identifier '{args.identifier}' in {db_name}.{args.collection}"))
    else:
        print(json.dumps(serialize_mongo_doc(doc), indent=2, default=str))

def cmd_mongo_schema(args: argparse.Namespace):
    """Analyze sample documents to infer field types and schema structure."""
    client = get_mongo_client()
    db_name = resolve_db_name(args.env)
    db = client[db_name]
    coll = db[args.collection]

    docs = list(coll.find().limit(args.sample_size))
    if not docs:
        print(c_warn(f"Collection '{db_name}.{args.collection}' is empty."))
        return

    schema_types: Dict[str, set] = {}
    sample_values: Dict[str, Any] = {}

    for doc in docs:
        for k, v in doc.items():
            schema_types.setdefault(k, set()).add(type(v).__name__)
            if k not in sample_values and v is not None:
                sample_values[k] = v

    print(c_bold(f"\nInferred Schema for '{db_name}.{args.collection}' (sampled {len(docs)} docs):"))
    print(f"{'Field':<25} {'Types':<20} {'Sample Value':<40}")
    print("-" * 85)
    for field in sorted(schema_types.keys()):
        types_str = ", ".join(sorted(schema_types[field]))
        sample_str = str(sample_values.get(field, ""))
        if len(sample_str) > 38:
            sample_str = sample_str[:35] + "..."
        print(f"{field:<25} {types_str:<20} {sample_str:<40}")
    print()

def cmd_mongo_indexes(args: argparse.Namespace):
    """List defined indexes, key specs, and uniqueness flags."""
    client = get_mongo_client()
    db_name = resolve_db_name(args.env)
    db = client[db_name]

    colls = [args.collection] if args.collection else db.list_collection_names()
    print(c_bold(f"\nIndexes in '{db_name}':"))
    for c in sorted(colls):
        idx_info = db[c].index_information()
        print(f"\n  Collection: {c_bold(c)} ({len(idx_info)} indexes)")
        for idx_name, meta in idx_info.items():
            keys = ", ".join(f"{k}:{v}" for k, v in meta.get("key", []))
            flags = []
            if meta.get("unique"):
                flags.append("UNIQUE")
            if meta.get("sparse"):
                flags.append("SPARSE")
            flags_str = f" [{', '.join(flags)}]" if flags else ""
            print(f"    - {idx_name:<28} keys: ({keys}){flags_str}")
    print()

def cmd_mongo_ensure_indexes(args: argparse.Namespace):
    """Verify and automatically create required production indexes across collections."""
    client = get_mongo_client()
    db_name = resolve_db_name(args.env)
    db = client[db_name]

    print(c_bold(f"\nEnsuring production indexes on database: '{db_name}'..."))
    indexes_created = 0

    index_specs = {
        "submissions": [
            ([("userId", 1), ("createdAt", -1)], {}),
            ([("questionId", 1), ("createdAt", -1)], {}),
            ([("userId", 1), ("questionId", 1), ("createdAt", -1)], {}),
        ],
        "user_activities": [
            ([("userId", 1)], {"unique": True}),
            ([("updatedAt", -1)], {}),
        ],
        "users": [
            ([("email", 1)], {"unique": True}),
            ([("studentId", 1)], {}),
        ],
        "questions": [
            ([("slug", 1)], {"unique": True}),
            ([("status", 1)], {}),
        ],
        "mcq_questions": [
            ([("slug", 1)], {"unique": True, "sparse": True}),
            ([("category", 1)], {}),
            ([("difficulty", 1)], {}),
            ([("status", 1)], {}),
            ([("createdAt", -1)], {}),
        ],
        "contests": [
            ([("slug", 1)], {"unique": True, "sparse": True}),
            ([("status", 1)], {}),
            ([("createdAt", -1)], {}),
        ],
        "contest_submissions": [
            ([("contestId", 1), ("studentId", 1)], {}),
            ([("submittedAt", -1)], {}),
        ],
    }

    for coll_name, specs in index_specs.items():
        if coll_name in db.list_collection_names() or args.create_empty:
            coll = db[coll_name]
            for keys, kwargs in specs:
                try:
                    name = coll.create_index(keys, **kwargs)
                    print(f"  {c_ok(f'{coll_name}: index {name}')}")
                    indexes_created += 1
                except Exception as e:
                    print(f"  {c_warn(f'{coll_name}: index failed: {e}')}")

    print(c_ok(f"\nSuccessfully verified/ensured {indexes_created} indexes on '{db_name}'.\n"))

def cmd_mongo_aggregate(args: argparse.Namespace):
    """Execute arbitrary aggregation pipeline against a collection."""
    client = get_mongo_client()
    db_name = resolve_db_name(args.env)
    db = client[db_name]
    coll = db[args.collection]

    pipeline = None
    if args.pipeline:
        try:
            pipeline = json.loads(args.pipeline)
        except json.JSONDecodeError as e:
            print(c_err(f"Invalid JSON in --pipeline: {e}"))
            sys.exit(1)
    elif args.file:
        p_path = Path(args.file)
        if not p_path.is_file():
            print(c_err(f"Pipeline file not found: {args.file}"))
            sys.exit(1)
        with open(p_path, "r") as f:
            pipeline = json.load(f)
    else:
        print(c_err("Must provide either --pipeline JSON string or --file path."))
        sys.exit(1)

    if not isinstance(pipeline, list):
        print(c_err("Aggregation pipeline must be a JSON array of pipeline stage objects."))
        sys.exit(1)

    print(c_bold(f"\nExecuting aggregation pipeline on {db_name}.{args.collection} ({len(pipeline)} stages)..."))
    start = time.perf_counter()
    cursor = coll.aggregate(pipeline)
    results = [serialize_mongo_doc(d) for d in cursor]
    elapsed = (time.perf_counter() - start) * 1000

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w") as f:
            json.dump(results, f, indent=2, default=str)
        print(c_ok(f"Saved {len(results)} results to {args.output} ({elapsed:.1f}ms)"))
    else:
        print(json.dumps(results, indent=2, default=str))
        print(f"\n{c_ok(f'Pipeline completed: returned {len(results)} records in {elapsed:.1f}ms')}")

def cmd_mongo_insert(args: argparse.Namespace):
    """Insert one or multiple documents into a collection."""
    client = get_mongo_client()
    db_name = resolve_db_name(args.env)
    db = client[db_name]
    coll = db[args.collection]

    payload = None
    if args.data:
        try:
            payload = json.loads(args.data)
        except json.JSONDecodeError as e:
            print(c_err(f"Invalid JSON in --data: {e}"))
            sys.exit(1)
    elif args.file:
        p_path = Path(args.file)
        if not p_path.is_file():
            print(c_err(f"Data file not found: {args.file}"))
            sys.exit(1)
        with open(p_path, "r") as f:
            payload = json.load(f)
    else:
        print(c_err("Must provide either --data JSON or --file path."))
        sys.exit(1)

    if isinstance(payload, list):
        res = coll.insert_many(payload)
        print(c_ok(f"Successfully inserted {len(res.inserted_ids)} documents into {db_name}.{args.collection}."))
    elif isinstance(payload, dict):
        res = coll.insert_one(payload)
        print(c_ok(f"Successfully inserted document into {db_name}.{args.collection}. ID: {res.inserted_id}"))
    else:
        print(c_err("Payload must be a JSON object or array of objects."))

def cmd_mongo_update(args: argparse.Namespace):
    """Update documents matching filter in collection."""
    client = get_mongo_client()
    db_name = resolve_db_name(args.env)
    db = client[db_name]
    coll = db[args.collection]

    try:
        q_filter = json.loads(args.filter)
    except json.JSONDecodeError as e:
        print(c_err(f"Invalid JSON in --filter: {e}"))
        sys.exit(1)

    try:
        update_spec = json.loads(args.update)
    except json.JSONDecodeError as e:
        print(c_err(f"Invalid JSON in --update: {e}"))
        sys.exit(1)

    if args.many:
        res = coll.update_many(q_filter, update_spec)
        print(c_ok(f"Updated {res.modified_count} documents (matched {res.matched_count}) in {db_name}.{args.collection}."))
    else:
        res = coll.update_one(q_filter, update_spec)
        print(c_ok(f"Updated {res.modified_count} document (matched {res.matched_count}) in {db_name}.{args.collection}."))

def cmd_mongo_delete(args: argparse.Namespace):
    """Delete documents matching filter from collection."""
    client = get_mongo_client()
    db_name = resolve_db_name(args.env)
    db = client[db_name]
    coll = db[args.collection]

    try:
        q_filter = json.loads(args.filter)
    except json.JSONDecodeError as e:
        print(c_err(f"Invalid JSON in --filter: {e}"))
        sys.exit(1)

    matched = coll.count_documents(q_filter)
    if matched == 0:
        print(c_warn(f"No documents match filter in {db_name}.{args.collection}."))
        return

    if args.many:
        res = coll.delete_many(q_filter)
        print(c_ok(f"Deleted {res.deleted_count} documents from {db_name}.{args.collection}."))
    else:
        res = coll.delete_one(q_filter)
        print(c_ok(f"Deleted {res.deleted_count} document from {db_name}.{args.collection}."))

def cmd_mongo_export(args: argparse.Namespace):
    """Export collection or query results to a JSON or CSV file."""
    client = get_mongo_client()
    db_name = resolve_db_name(args.env)
    db = client[db_name]
    coll = db[args.collection]

    q_filter = {}
    if args.filter:
        try:
            q_filter = json.loads(args.filter)
        except json.JSONDecodeError as e:
            print(c_err(f"Invalid JSON in --filter: {e}"))
            sys.exit(1)

    projection = None
    if args.fields:
        field_list = [f.strip() for f in args.fields.split(",")]
        projection = {f: 1 for f in field_list}

    cursor = coll.find(q_filter, projection)
    if args.limit:
        cursor = cursor.limit(args.limit)

    docs = [serialize_mongo_doc(d) for d in cursor]
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if out_path.suffix.lower() == ".csv":
        if not docs:
            print(c_warn("No documents to export to CSV."))
            return
        keys = list(docs[0].keys())
        with open(out_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            for doc in docs:
                row = {k: json.dumps(v) if isinstance(v, (dict, list)) else v for k, v in doc.items()}
                writer.writerow(row)
    else:
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(docs, f, indent=2, default=str)

    print(c_ok(f"Exported {len(docs)} documents from {db_name}.{args.collection} to {args.output}"))

def cmd_mongo_import(args: argparse.Namespace):
    """Import documents from JSON or CSV into collection (with optional upsert)."""
    client = get_mongo_client()
    db_name = resolve_db_name(args.env)
    db = client[db_name]
    coll = db[args.collection]

    in_path = Path(args.input)
    if not in_path.is_file():
        print(c_err(f"Input file not found: {args.input}"))
        sys.exit(1)

    docs = []
    if in_path.suffix.lower() == ".csv":
        with open(in_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Try parse json subfields
                cleaned_row = {}
                for k, v in row.items():
                    if v.startswith(("{", "[")) and v.endswith(("}", "]")):
                        try:
                            cleaned_row[k] = json.loads(v)
                            continue
                        except Exception:
                            pass
                    cleaned_row[k] = v
                docs.append(cleaned_row)
    else:
        with open(in_path, "r", encoding="utf-8") as f:
            loaded = json.load(f)
            docs = loaded if isinstance(loaded, list) else [loaded]

    if not docs:
        print(c_warn("No documents found in input file."))
        return

    imported = 0
    if args.upsert:
        key = args.upsert_key or "id"
        for doc in docs:
            filter_val = doc.get(key) or doc.get("_id")
            if filter_val:
                coll.replace_one({"$or": [{key: filter_val}, {"_id": filter_val}]}, doc, upsert=True)
            else:
                coll.insert_one(doc)
            imported += 1
        print(c_ok(f"Upserted {imported} documents into {db_name}.{args.collection}."))
    else:
        res = coll.insert_many(docs)
        print(c_ok(f"Inserted {len(res.inserted_ids)} documents into {db_name}.{args.collection}."))

def cmd_mongo_backup(args: argparse.Namespace):
    """Backup all collections in a database to JSON files in target directory."""
    client = get_mongo_client()
    db_name = resolve_db_name(args.env)
    db = client[db_name]

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    colls = sorted(db.list_collection_names())

    print(c_bold(f"\nBacking up database '{db_name}' ({len(colls)} collections) to '{out_dir}'..."))
    total_docs = 0

    for c in colls:
        docs = [serialize_mongo_doc(d) for d in db[c].find()]
        c_file = out_dir / f"{c}.json"
        with open(c_file, "w", encoding="utf-8") as f:
            json.dump(docs, f, indent=2, default=str)
        print(f"  {c_ok(f'{c:<25} ({len(docs):,} documents -> {c_file.name})')}")
        total_docs += len(docs)

    print(c_ok(f"\nDatabase backup complete: {total_docs:,} total documents saved in {out_dir}\n"))

def cmd_mongo_sync_to_lower(args: argparse.Namespace):
    """Safely copy documents from zap_platform_prod to zap_platform_lower (one-way)."""
    client = get_mongo_client()
    source_db = client["zap_platform_prod"]
    target_db = client["zap_platform_lower"]
    coll_name = args.collection

    if coll_name in ("submissions", "user_activities") and not args.force:
        print(c_warn(f"Syncing '{coll_name}' involves user submission records. Use --force if explicitly intended."))
        return

    filter_dict = {}
    if args.filter:
        try:
            filter_dict = json.loads(args.filter)
        except json.JSONDecodeError as e:
            print(c_err(f"Invalid JSON in --filter: {e}"))
            sys.exit(1)

    cursor = source_db[coll_name].find(filter_dict)
    if args.limit:
        cursor = cursor.limit(args.limit)

    docs = list(cursor)
    if not docs:
        print(c_warn(f"No documents found matching filter in zap_platform_prod.{coll_name}"))
        return

    print(c_bold(f"\nSyncing {len(docs)} documents from zap_platform_prod.{coll_name} -> zap_platform_lower.{coll_name}..."))
    synced = 0
    for doc in docs:
        target_db[coll_name].replace_one({"_id": doc["_id"]}, doc, upsert=True)
        synced += 1

    print(c_ok(f"Successfully upserted {synced} documents into zap_platform_lower.{coll_name}.\n"))


# ==============================================================================
# 3. GCP OPERATIONS
# ==============================================================================

def cmd_gcp_services(args: argparse.Namespace):
    """Inspect Cloud Run services, readiness, URLs, and active revisions."""
    gcloud_bin = shutil.which("gcloud")
    if not gcloud_bin:
        print(c_err("gcloud CLI not installed or not in PATH!"))
        sys.exit(1)

    project = args.project or DEFAULT_GCP_PROJECT
    region = args.region or DEFAULT_GCP_REGION

    cmd = [
        gcloud_bin, "run", "services", "list",
        f"--project={project}",
        f"--region={region}",
        "--format=json"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(c_err(f"Failed to fetch Cloud Run services: {res.stderr}"))
        sys.exit(1)

    services = json.loads(res.stdout)
    print(c_bold(f"\nCloud Run Services in '{project}' ({region}):"))
    print(f"{'Service':<16} {'Ready':<8} {'URL':<50} {'Active Revision':<26}")
    print("-" * 102)
    for svc in services:
        name = svc.get("metadata", {}).get("name", "")
        url = svc.get("status", {}).get("address", {}).get("url", "")
        conditions = svc.get("status", {}).get("conditions", [])
        ready = any(c.get("type") == "Ready" and c.get("status") == "True" for c in conditions)
        ready_str = c_ok("YES") if ready else c_err("NO")
        rev = svc.get("status", {}).get("latestReadyRevisionName", "")
        print(f"{name:<16} {ready_str:<17} {url:<50} {rev:<26}")
    print()

def cmd_gcp_tasks(args: argparse.Namespace):
    """Inspect Cloud Tasks queues, states, dispatches, and concurrency limits."""
    gcloud_bin = shutil.which("gcloud")
    if not gcloud_bin:
        print(c_err("gcloud CLI not installed or not in PATH!"))
        sys.exit(1)

    project = args.project or DEFAULT_GCP_PROJECT
    region = args.region or DEFAULT_GCP_REGION

    cmd = [
        gcloud_bin, "tasks", "queues", "list",
        f"--project={project}",
        f"--location={region}",
        "--format=json"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(c_err(f"Failed to fetch Cloud Tasks queues: {res.stderr}"))
        sys.exit(1)

    queues = json.loads(res.stdout)
    print(c_bold(f"\nCloud Tasks Queues in '{project}' ({region}):"))
    print(f"{'Queue Name':<26} {'State':<12} {'Max Dispatches/s':<18} {'Max Concurrent':<15}")
    print("-" * 75)
    for q in queues:
        name = q.get("name", "").split("/")[-1]
        state = q.get("state", "UNKNOWN")
        state_str = c_ok(state) if state == "RUNNING" else c_warn(state)
        rate_limits = q.get("rateLimits", {})
        max_rate = rate_limits.get("maxDispatchesPerSecond", "default")
        max_conc = rate_limits.get("maxConcurrentDispatches", "default")
        print(f"{name:<26} {state_str:<21} {str(max_rate):<18} {str(max_conc):<15}")
    print()

def cmd_gcp_queue_state(args: argparse.Namespace):
    """Pause or resume a Cloud Tasks queue."""
    gcloud_bin = shutil.which("gcloud")
    if not gcloud_bin:
        print(c_err("gcloud CLI not installed or not in PATH!"))
        sys.exit(1)

    project = args.project or DEFAULT_GCP_PROJECT
    region = args.region or DEFAULT_GCP_REGION
    queue_name = args.queue

    if "prod" in queue_name and not args.confirm_prod:
        print(c_err("Safety Lock: Refusing to modify production queue without --confirm-prod!"))
        sys.exit(1)

    action = args.action  # "pause" or "resume"
    cmd = [
        gcloud_bin, "tasks", "queues", action,
        queue_name,
        f"--project={project}",
        f"--location={region}",
        "--quiet"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0:
        print(c_ok(f"Cloud Tasks queue '{queue_name}' is now {action}d."))
    else:
        print(c_err(f"Failed to {action} queue '{queue_name}': {res.stderr.strip()}"))

def cmd_gcp_logs(args: argparse.Namespace):
    """Fetch and filter Cloud Run container logs."""
    gcloud_bin = shutil.which("gcloud")
    if not gcloud_bin:
        print(c_err("gcloud CLI not installed or not in PATH!"))
        sys.exit(1)

    project = args.project or DEFAULT_GCP_PROJECT
    service_target = f"zap-{args.service}" if not args.service.startswith("zap-") else args.service

    filter_parts = [
        'resource.type="cloud_run_revision"',
        f'resource.labels.service_name="{service_target}"',
    ]
    if args.severity:
        filter_parts.append(f'severity>={args.severity.upper()}')
    if args.search:
        filter_parts.append(f'textPayload:"{args.search}"')

    filter_str = " AND ".join(filter_parts)
    print(c_bold(f"\nQuerying logs for '{service_target}' in '{project}'..."))
    print(f"Filter: {filter_str}\n")

    cmd = [
        gcloud_bin, "logging", "read",
        filter_str,
        f"--project={project}",
        f"--limit={args.limit}",
        "--format=table(timestamp,severity,textPayload)"
    ]
    subprocess.run(cmd)

def cmd_gcp_secrets(args: argparse.Namespace):
    """List Secret Manager secrets without exposing plaintext secret values."""
    gcloud_bin = shutil.which("gcloud")
    if not gcloud_bin:
        print(c_err("gcloud CLI not installed or not in PATH!"))
        sys.exit(1)

    project = args.project or DEFAULT_GCP_PROJECT
    cmd = [
        gcloud_bin, "secrets", "list",
        f"--project={project}",
        "--format=table(name.basename(),replication.automatic:label=AUTOMATIC,createTime)"
    ]
    print(c_bold(f"\nSecret Manager Secrets in '{project}':\n"))
    subprocess.run(cmd)

def cmd_gcp_scale(args: argparse.Namespace):
    """Update Cloud Run service scaling parameters (min/max instances, cpu, memory, concurrency)."""
    gcloud_bin = shutil.which("gcloud")
    if not gcloud_bin:
        print(c_err("gcloud CLI not installed or not in PATH!"))
        sys.exit(1)

    project = args.project or DEFAULT_GCP_PROJECT
    region = args.region or DEFAULT_GCP_REGION
    service_target = f"zap-{args.service}" if not args.service.startswith("zap-") else args.service

    flags = []
    if args.min_instances is not None:
        flags.append(f"--min-instances={args.min_instances}")
    if args.max_instances is not None:
        flags.append(f"--max-instances={args.max_instances}")
    if args.cpu is not None:
        flags.append(f"--cpu={args.cpu}")
    if args.memory is not None:
        flags.append(f"--memory={args.memory}")
    if args.concurrency is not None:
        flags.append(f"--concurrency={args.concurrency}")

    if not flags:
        print(c_warn("No scaling flags specified. Pass at least one of: --min-instances, --max-instances, --cpu, --memory, --concurrency"))
        return

    cmd = [
        gcloud_bin, "run", "services", "update", service_target,
        f"--project={project}",
        f"--region={region}",
    ] + flags + ["--quiet"]

    print(c_bold(f"\nUpdating Cloud Run '{service_target}' scaling configuration..."))
    print(f"Command: {' '.join(cmd)}\n")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0:
        print(c_ok(f"Successfully updated configuration for '{service_target}'.\n"))
    else:
        print(c_err(f"Failed to update scaling for '{service_target}': {res.stderr.strip()}\n"))

def cmd_gcp_deploy_status(args: argparse.Namespace):
    """Check whether the latest Git commit matches the currently deployed Cloud Run revisions."""
    gcloud_bin = shutil.which("gcloud")
    if not gcloud_bin:
        print(c_err("gcloud CLI not installed or not in PATH!"))
        sys.exit(1)

    project = args.project or DEFAULT_GCP_PROJECT
    region = args.region or DEFAULT_GCP_REGION

    # 1. Get latest Git commit SHA
    git_bin = shutil.which("git") or "git"
    git_res = subprocess.run([git_bin, "rev-parse", "HEAD"], capture_output=True, text=True)
    git_head = git_res.stdout.strip() if git_res.returncode == 0 else "UNKNOWN"
    git_short = git_head[:7]

    print(c_bold("\n======================================================="))
    print(c_bold("           DEPLOYMENT REVISION SYNC CHECK              "))
    print(c_bold("=======================================================\n"))
    print(f"Local Git HEAD SHA: {c_bold(git_head)} ({git_short})\n")

    for svc in ["zap-api", "zap-executor"]:
        cmd = [
            gcloud_bin, "run", "services", "describe", svc,
            f"--project={project}",
            f"--region={region}",
            "--format=json"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            data = json.loads(res.stdout)
            containers = data.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
            image_uri = containers[0].get("image", "") if containers else ""
            img_tag = image_uri.split(":")[-1] if ":" in image_uri else ""
            rev_name = data.get("status", {}).get("latestReadyRevisionName", "")

            synced = (img_tag == git_head) or (git_head.startswith(img_tag) and len(img_tag) >= 7)
            status_str = c_ok("SYNCED (LATEST)") if synced else c_warn("DESYNCED (PENDING DEPLOY)")
            print(f"Service: {c_bold(svc)}")
            print(f"  Deployed Revision: {rev_name}")
            print(f"  Container Image:   {image_uri}")
            print(f"  Image Tag:         {img_tag}")
            print(f"  Status:            {status_str}\n")
        else:
            print(f"  {c_err(f'Could not describe {svc}: {res.stderr.strip()}')}\n")


# ==============================================================================
# 4. GITHUB CI/CD OPERATIONS
# ==============================================================================

def cmd_github_runs(args: argparse.Namespace):
    """List recent GitHub Actions CI/CD runs."""
    gh_bin = shutil.which("gh")
    if not gh_bin:
        print(c_err("gh CLI not installed or not in PATH!"))
        sys.exit(1)

    gh_env = get_gh_env()
    cmd = [
        gh_bin, "run", "list",
        "--repo", args.repo,
        "--limit", str(args.limit),
    ]
    if args.workflow:
        cmd.extend(["--workflow", args.workflow])

    subprocess.run(cmd, env=gh_env)

def cmd_github_view(args: argparse.Namespace):
    """View details and failed logs for a workflow run ID."""
    gh_bin = shutil.which("gh")
    if not gh_bin:
        print(c_err("gh CLI not installed or not in PATH!"))
        sys.exit(1)

    gh_env = get_gh_env()
    cmd = [gh_bin, "run", "view", args.run_id, "--repo", args.repo]
    if args.failed_logs:
        cmd.append("--log-failed")
    subprocess.run(cmd, env=gh_env)

def cmd_github_status(args: argparse.Namespace):
    """Check repository PR and status overview."""
    gh_bin = shutil.which("gh")
    if not gh_bin:
        print(c_err("gh CLI not installed or not in PATH!"))
        sys.exit(1)

    gh_env = get_gh_env()
    print(c_bold(f"\nRepository Status for '{args.repo}':\n"))
    subprocess.run([gh_bin, "repo", "view", args.repo], env=gh_env)

def cmd_github_trigger(args: argparse.Namespace):
    """Trigger GitHub Actions workflow dispatch."""
    gh_bin = shutil.which("gh")
    if not gh_bin:
        print(c_err("gh CLI not installed or not in PATH!"))
        sys.exit(1)

    gh_env = get_gh_env()
    cmd = [
        gh_bin, "workflow", "run", args.workflow,
        "--repo", args.repo,
        "--ref", args.ref
    ]
    if args.target:
        cmd.extend(["-f", f"target={args.target}"])

    print(c_bold(f"\nTriggering workflow '{args.workflow}' on branch '{args.ref}'..."))
    res = subprocess.run(cmd, env=gh_env, capture_output=True, text=True)
    if res.returncode == 0:
        print(c_ok(f"Workflow '{args.workflow}' triggered successfully.\n"))
    else:
        print(c_err(f"Failed to trigger workflow: {res.stderr.strip()}\n"))

def cmd_github_exec(args: argparse.Namespace):
    """Execute arbitrary gh CLI command with automatic token authentication."""
    gh_bin = shutil.which("gh")
    if not gh_bin:
        print(c_err("gh CLI not installed or not in PATH!"))
        sys.exit(1)

    gh_env = get_gh_env()
    cmd = [gh_bin] + args.subargs
    subprocess.run(cmd, env=gh_env)


# ==============================================================================
# 5. GIT OPERATIONS
# ==============================================================================

def cmd_git_status(args: argparse.Namespace):
    """Check local git working tree, current branch, and tracking status."""
    git_bin = shutil.which("git") or "git"
    print(c_bold("\nLocal Git Repository Status:\n"))
    subprocess.run([git_bin, "status"])

def cmd_git_recent(args: argparse.Namespace):
    """List recent commits with concise hash, author, date, and subject."""
    git_bin = shutil.which("git") or "git"
    cmd = [
        git_bin, "log",
        f"-n{args.limit}",
        "--pretty=format:%C(yellow)%h%Creset %C(green)%cd%Creset %C(cyan)%an%Creset: %s",
        "--date=short"
    ]
    print(c_bold(f"\nRecent {args.limit} Git Commits:\n"))
    subprocess.run(cmd)
    print("\n")


# ==============================================================================
# MAIN CLI DISPATCHER
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(
        prog="zap_ops",
        description="ZAP Unified Cloud & Repository Operations CLI: MongoDB Atlas, GCP Cloud Run/Tasks/Logs, and Git/GitHub."
    )
    subparsers = parser.add_subparsers(dest="command", help="Operational domain")

    # 1. DOCTOR & STATUS
    doc_parser = subparsers.add_parser("doctor", help="Run full platform health check across all services")
    doc_parser.add_argument("--project", default=DEFAULT_GCP_PROJECT, help="GCP Project ID")
    doc_parser.add_argument("--region", default=DEFAULT_GCP_REGION, help="GCP Region")
    doc_parser.set_defaults(func=cmd_doctor)

    status_parser = subparsers.add_parser("status", help="Alias for doctor")
    status_parser.add_argument("--project", default=DEFAULT_GCP_PROJECT, help="GCP Project ID")
    status_parser.add_argument("--region", default=DEFAULT_GCP_REGION, help="GCP Region")
    status_parser.set_defaults(func=cmd_doctor)

    # 2. MONGODB
    mongo_parser = subparsers.add_parser("mongo", help="MongoDB Atlas queries, schema, writes, and data management")
    mongo_sub = mongo_parser.add_subparsers(dest="mongo_command", help="MongoDB action")

    # ping
    m_ping = mongo_sub.add_parser("ping", help="Ping MongoDB cluster and measure latency")
    m_ping.set_defaults(func=cmd_mongo_ping)

    # list
    m_list = mongo_sub.add_parser("list", help="List collections, doc counts, and index counts")
    m_list.add_argument("--env", choices=["prod", "production", "lower", "qa"], default="prod", help="Target environment")
    m_list.set_defaults(func=cmd_mongo_list)

    # count
    m_count = mongo_sub.add_parser("count", help="Compare document counts between prod and lower databases")
    m_count.set_defaults(func=cmd_mongo_count)

    # query
    m_query = mongo_sub.add_parser("query", help="Query documents with JSON filter and projection")
    m_query.add_argument("--env", choices=["prod", "production", "lower", "qa"], default="prod", help="Target environment")
    m_query.add_argument("--collection", "-c", required=True, help="Collection name")
    m_query.add_argument("--filter", "-f", default=None, help='JSON query filter (e.g. \'{"status": "QUEUED"}\')')
    m_query.add_argument("--fields", default=None, help="Comma-separated projection fields")
    m_query.add_argument("--sort", default=None, help="Sort field and direction (e.g. 'createdAt:-1')")
    m_query.add_argument("--limit", "-n", type=int, default=5, help="Max documents to return")
    m_query.add_argument("--format", choices=["json", "table"], default="table", help="Output format")
    m_query.set_defaults(func=cmd_mongo_query)

    # get
    m_get = mongo_sub.add_parser("get", help="Get a single document by ID, slug, or email")
    m_get.add_argument("--env", choices=["prod", "production", "lower", "qa"], default="prod", help="Target environment")
    m_get.add_argument("--collection", "-c", required=True, help="Collection name")
    m_get.add_argument("identifier", help="Identifier (ObjectId, id, slug, userId, or email)")
    m_get.set_defaults(func=cmd_mongo_get)

    # schema
    m_schema = mongo_sub.add_parser("schema", help="Infer document fields and schema types from sample")
    m_schema.add_argument("--env", choices=["prod", "production", "lower", "qa"], default="prod", help="Target environment")
    m_schema.add_argument("--collection", "-c", required=True, help="Collection name")
    m_schema.add_argument("--sample-size", type=int, default=20, help="Number of documents to sample")
    m_schema.set_defaults(func=cmd_mongo_schema)

    # indexes
    m_idx = mongo_sub.add_parser("indexes", help="List collection indexes and metadata")
    m_idx.add_argument("--env", choices=["prod", "production", "lower", "qa"], default="prod", help="Target environment")
    m_idx.add_argument("--collection", "-c", default=None, help="Optional collection name filter")
    m_idx.set_defaults(func=cmd_mongo_indexes)

    # ensure-indexes
    m_ensure_idx = mongo_sub.add_parser("ensure-indexes", help="Ensure all production-defined indexes on database")
    m_ensure_idx.add_argument("--env", choices=["prod", "production", "lower", "qa"], default="prod", help="Target environment")
    m_ensure_idx.add_argument("--create-empty", action="store_true", help="Create collections if empty")
    m_ensure_idx.set_defaults(func=cmd_mongo_ensure_indexes)

    # aggregate
    m_agg = mongo_sub.add_parser("aggregate", help="Execute MongoDB aggregation pipeline")
    m_agg.add_argument("--env", choices=["prod", "production", "lower", "qa"], default="prod", help="Target environment")
    m_agg.add_argument("--collection", "-c", required=True, help="Collection name")
    m_agg.add_argument("--pipeline", "-p", default=None, help="JSON aggregation pipeline array string")
    m_agg.add_argument("--file", "-f", default=None, help="Path to JSON file containing pipeline array")
    m_agg.add_argument("--output", "-o", default=None, help="Optional path to save JSON results")
    m_agg.set_defaults(func=cmd_mongo_aggregate)

    # insert
    m_ins = mongo_sub.add_parser("insert", help="Insert document(s) into collection")
    m_ins.add_argument("--env", choices=["prod", "production", "lower", "qa"], default="prod", help="Target environment")
    m_ins.add_argument("--collection", "-c", required=True, help="Collection name")
    m_ins.add_argument("--data", "-d", default=None, help="JSON document or array of documents")
    m_ins.add_argument("--file", "-f", default=None, help="JSON file containing document(s)")
    m_ins.set_defaults(func=cmd_mongo_insert)

    # update
    m_up = mongo_sub.add_parser("update", help="Update document(s) matching filter")
    m_up.add_argument("--env", choices=["prod", "production", "lower", "qa"], default="prod", help="Target environment")
    m_up.add_argument("--collection", "-c", required=True, help="Collection name")
    m_up.add_argument("--filter", "-f", required=True, help="JSON query filter")
    m_up.add_argument("--update", "-u", required=True, help="JSON update modifier (e.g. '{\"$set\": {\"status\": \"ACTIVE\"}}')")
    m_up.add_argument("--many", action="store_true", help="Update all matching documents")
    m_up.set_defaults(func=cmd_mongo_update)

    # delete
    m_del = mongo_sub.add_parser("delete", help="Delete document(s) matching filter")
    m_del.add_argument("--env", choices=["prod", "production", "lower", "qa"], default="prod", help="Target environment")
    m_del.add_argument("--collection", "-c", required=True, help="Collection name")
    m_del.add_argument("--filter", "-f", required=True, help="JSON query filter")
    m_del.add_argument("--many", action="store_true", help="Delete all matching documents")
    m_del.set_defaults(func=cmd_mongo_delete)

    # export
    m_exp = mongo_sub.add_parser("export", help="Export collection or query results to JSON or CSV")
    m_exp.add_argument("--env", choices=["prod", "production", "lower", "qa"], default="prod", help="Target environment")
    m_exp.add_argument("--collection", "-c", required=True, help="Collection name")
    m_exp.add_argument("--output", "-o", required=True, help="Output file path (.json or .csv)")
    m_exp.add_argument("--filter", "-f", default=None, help="Optional JSON filter")
    m_exp.add_argument("--fields", default=None, help="Comma-separated projection fields")
    m_exp.add_argument("--limit", type=int, default=None, help="Max records to export")
    m_exp.set_defaults(func=cmd_mongo_export)

    # import
    m_imp = mongo_sub.add_parser("import", help="Import documents from JSON or CSV into collection")
    m_imp.add_argument("--env", choices=["prod", "production", "lower", "qa"], default="prod", help="Target environment")
    m_imp.add_argument("--collection", "-c", required=True, help="Collection name")
    m_imp.add_argument("--input", "-i", required=True, help="Input file path (.json or .csv)")
    m_imp.add_argument("--upsert", action="store_true", help="Upsert documents instead of insert")
    m_imp.add_argument("--upsert-key", default="id", help="Key field for upsert (default: id)")
    m_imp.set_defaults(func=cmd_mongo_import)

    # backup
    m_bkp = mongo_sub.add_parser("backup", help="Dump all collections in database to a folder as JSON files")
    m_bkp.add_argument("--env", choices=["prod", "production", "lower", "qa"], default="lower", help="Target environment (default: lower)")
    m_bkp.add_argument("--output-dir", "-o", required=True, help="Destination directory path")
    m_bkp.set_defaults(func=cmd_mongo_backup)

    # sync-to-lower
    m_sync = mongo_sub.add_parser("sync-to-lower", help="Safely sync documents from prod to lower (QA) database")
    m_sync.add_argument("--collection", "-c", required=True, help="Collection name")
    m_sync.add_argument("--filter", "-f", default=None, help="Optional JSON filter")
    m_sync.add_argument("--limit", type=int, default=None, help="Max documents to sync")
    m_sync.add_argument("--force", action="store_true", help="Force sync on large/sensitive collections")
    m_sync.set_defaults(func=cmd_mongo_sync_to_lower)

    # 3. GCP
    gcp_parser = subparsers.add_parser("gcp", help="Google Cloud Platform operations (Run, Tasks, Logs, Secrets, Scale)")
    gcp_sub = gcp_parser.add_subparsers(dest="gcp_command", help="GCP action")

    g_svc = gcp_sub.add_parser("services", help="Inspect Cloud Run services status and URLs")
    g_svc.add_argument("--project", default=DEFAULT_GCP_PROJECT, help="GCP Project ID")
    g_svc.add_argument("--region", default=DEFAULT_GCP_REGION, help="GCP Region")
    g_svc.set_defaults(func=cmd_gcp_services)

    g_tasks = gcp_sub.add_parser("tasks", help="Inspect Cloud Tasks queues")
    g_tasks.add_argument("--project", default=DEFAULT_GCP_PROJECT, help="GCP Project ID")
    g_tasks.add_argument("--region", default=DEFAULT_GCP_REGION, help="GCP Region")
    g_tasks.set_defaults(func=cmd_gcp_tasks)

    g_qstate = gcp_sub.add_parser("queue-state", help="Pause or resume a Cloud Tasks queue")
    g_qstate.add_argument("queue", help="Queue name (e.g. zap-submissions)")
    g_qstate.add_argument("action", choices=["pause", "resume"], help="Action to perform")
    g_qstate.add_argument("--confirm-prod", action="store_true", help="Explicit confirmation for production queue")
    g_qstate.add_argument("--project", default=DEFAULT_GCP_PROJECT, help="GCP Project ID")
    g_qstate.add_argument("--region", default=DEFAULT_GCP_REGION, help="GCP Region")
    g_qstate.set_defaults(func=cmd_gcp_queue_state)

    g_logs = gcp_sub.add_parser("logs", help="Fetch recent Cloud Run logs")
    g_logs.add_argument("--service", choices=["api", "executor", "zap-api", "zap-executor"], default="api", help="Service name")
    g_logs.add_argument("--severity", choices=["INFO", "WARNING", "ERROR", "CRITICAL"], default=None, help="Minimum severity")
    g_logs.add_argument("--limit", type=int, default=20, help="Number of entries")
    g_logs.add_argument("--search", default=None, help="Text substring search in payload")
    g_logs.add_argument("--project", default=DEFAULT_GCP_PROJECT, help="GCP Project ID")
    g_logs.set_defaults(func=cmd_gcp_logs)

    g_sec = gcp_sub.add_parser("secrets", help="List Secret Manager secrets")
    g_sec.add_argument("--project", default=DEFAULT_GCP_PROJECT, help="GCP Project ID")
    g_sec.set_defaults(func=cmd_gcp_secrets)

    g_scale = gcp_sub.add_parser("scale", help="Update Cloud Run service scaling parameters")
    g_scale.add_argument("--service", choices=["api", "executor", "zap-api", "zap-executor"], required=True, help="Target service")
    g_scale.add_argument("--min-instances", type=int, default=None, help="Min instances (e.g. 1)")
    g_scale.add_argument("--max-instances", type=int, default=None, help="Max instances (e.g. 10)")
    g_scale.add_argument("--cpu", default=None, help="CPU allocation (e.g. 1, 2)")
    g_scale.add_argument("--memory", default=None, help="Memory allocation (e.g. 512Mi, 2Gi)")
    g_scale.add_argument("--concurrency", type=int, default=None, help="Max concurrent requests per container")
    g_scale.add_argument("--project", default=DEFAULT_GCP_PROJECT, help="GCP Project ID")
    g_scale.add_argument("--region", default=DEFAULT_GCP_REGION, help="GCP Region")
    g_scale.set_defaults(func=cmd_gcp_scale)

    g_dep = gcp_sub.add_parser("deploy-status", help="Check whether latest Git commit is deployed to Cloud Run")
    g_dep.add_argument("--project", default=DEFAULT_GCP_PROJECT, help="GCP Project ID")
    g_dep.add_argument("--region", default=DEFAULT_GCP_REGION, help="GCP Region")
    g_dep.set_defaults(func=cmd_gcp_deploy_status)

    # 4. GITHUB
    gh_parser = subparsers.add_parser("github", help="GitHub & CI/CD workflow operations")
    gh_sub = gh_parser.add_subparsers(dest="github_command", help="GitHub action")

    gh_runs = gh_sub.add_parser("runs", help="List recent workflow runs")
    gh_runs.add_argument("--repo", default=DEFAULT_REPO, help="Repository")
    gh_runs.add_argument("--limit", type=int, default=5, help="Number of runs")
    gh_runs.add_argument("--workflow", default=None, help="Workflow name or file")
    gh_runs.set_defaults(func=cmd_github_runs)

    gh_view = gh_sub.add_parser("view", help="View a specific workflow run and its logs")
    gh_view.add_argument("run_id", help="GitHub Actions run ID")
    gh_view.add_argument("--repo", default=DEFAULT_REPO, help="Repository")
    gh_view.add_argument("--failed-logs", action="store_true", help="Display failed step logs directly")
    gh_view.set_defaults(func=cmd_github_view)

    gh_stat = gh_sub.add_parser("status", help="View repository status and metadata")
    gh_stat.add_argument("--repo", default=DEFAULT_REPO, help="Repository")
    gh_stat.set_defaults(func=cmd_github_status)

    gh_trig = gh_sub.add_parser("trigger", help="Trigger workflow dispatch")
    gh_trig.add_argument("--workflow", default="ci.yml", help="Workflow file (default: ci.yml)")
    gh_trig.add_argument("--ref", default="main", help="Git branch or ref (default: main)")
    gh_trig.add_argument("--target", choices=["auto", "all", "backend", "frontend"], default="auto", help="Component target")
    gh_trig.add_argument("--repo", default=DEFAULT_REPO, help="Repository")
    gh_trig.set_defaults(func=cmd_github_trigger)

    gh_exec = gh_sub.add_parser("exec", help="Run arbitrary gh CLI command with auth")
    gh_exec.add_argument("subargs", nargs=argparse.REMAINDER, help="Arguments passed to gh")
    gh_exec.set_defaults(func=cmd_github_exec)

    # 5. GIT
    git_parser = subparsers.add_parser("git", help="Local Git repository status and commit history")
    git_sub = git_parser.add_subparsers(dest="git_command", help="Git action")

    git_stat = git_sub.add_parser("status", help="Working tree status and branch info")
    git_stat.set_defaults(func=cmd_git_status)

    git_rec = git_sub.add_parser("recent", help="List recent commits")
    git_rec.add_argument("--limit", "-n", type=int, default=5, help="Number of commits")
    git_rec.set_defaults(func=cmd_git_recent)

    args = parser.parse_args()
    if not hasattr(args, "func"):
        parser.print_help()
        sys.exit(1)

    args.func(args)

if __name__ == "__main__":
    main()
