#!/usr/bin/env python3
"""ZAP Cloud & Database Operations CLI (zap_ops).

Provides unified, safe, and scriptable access to:
1. MongoDB Atlas (production & lower/QA environments)
2. Google Cloud Platform (Cloud Run, Cloud Tasks, Secret Manager, Cloud Logging)
3. GitHub / CI/CD (Workflow runs, deployment statuses, repository metadata)

Usage examples:
    # Full environment doctor / health check:
    python zap_ops.py doctor

    # MongoDB operations:
    python zap_ops.py mongo list --env prod
    python zap_ops.py mongo count
    python zap_ops.py mongo query --env prod --collection questions --fields slug,title,difficulty --limit 5
    python zap_ops.py mongo schema --env prod --collection submissions
    python zap_ops.py mongo indexes --env prod

    # GCP operations:
    python zap_ops.py gcp services
    python zap_ops.py gcp tasks
    python zap_ops.py gcp logs --service api --severity ERROR --limit 20
    python zap_ops.py gcp secrets

    # GitHub operations:
    python zap_ops.py github runs --limit 5
    python zap_ops.py github view <RUN_ID>
"""

import os
import sys
import json
import time
import shutil
import argparse
import subprocess
from pathlib import Path
from typing import Any, Optional

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

# Constants
DEFAULT_GCP_PROJECT = os.getenv("GCP_PROJECT_ID", "zap-platform-prod")
DEFAULT_GCP_REGION = os.getenv("GCP_LOCATION", "us-central1")
DB_NAMES = {
    "prod": "zap_platform_prod",
    "production": "zap_platform_prod",
    "lower": "zap_platform_lower",
    "qa": "zap_platform_lower",
}
QUEUE_NAMES = {
    "prod": "zap-submissions",
    "production": "zap-submissions",
    "lower": "zap-submissions-lower",
    "qa": "zap-submissions-lower",
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

def get_mongo_client(timeout_ms: int = 5000):
    """Retrieve PyMongo client using MONGO_URI from environment."""
    uri = os.getenv("MONGO_URI") or os.getenv("MONGODB_URI")
    if not uri:
        raise ValueError(
            "MongoDB URI not found! Please ensure MONGO_URI or MONGODB_URI is set in .env."
        )
    try:
        from pymongo import MongoClient
        return MongoClient(uri, serverSelectionTimeoutMS=timeout_ms)
    except ImportError:
        raise RuntimeError("pymongo package not found. Run in .venv or install pymongo.")

def resolve_db_name(env: str) -> str:
    env_clean = env.strip().lower()
    if env_clean in DB_NAMES:
        return DB_NAMES[env_clean]
    return env

def get_gh_env() -> dict[str, str]:
    """Prepare environment for gh CLI, injecting GIT_TOKEN as GH_TOKEN if needed."""
    env = os.environ.copy()
    if "GH_TOKEN" not in env and "GITHUB_TOKEN" not in env:
        git_token = os.getenv("GIT_TOKEN")
        if git_token:
            env["GH_TOKEN"] = git_token
    return env


# ==============================================================================
# 1. DOCTOR / UNIFIED STATUS DASHBOARD
# ==============================================================================

def cmd_doctor(args: argparse.Namespace):
    """Run full diagnostic across MongoDB, GCP, and GitHub."""
    print(c_bold("\n======================================================="))
    print(c_bold("       ZAP PLATFORM INFRASTRUCTURE & DATA HEALTH       "))
    print(c_bold("=======================================================\n"))

    # 1. MongoDB Check
    print(c_bold("1. MongoDB Atlas:"))
    try:
        client = get_mongo_client(timeout_ms=4000)
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
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=12)
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
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=12)
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
                print(f"  {c_warn('GitHub CLI not authenticated (set GIT_TOKEN in .env or run gh auth login)')}")

            # Check latest workflow run
            runs_cmd = [
                gh_bin, "run", "list",
                "--repo", "alendnl/zap",
                "--limit", "1",
                "--json", "name,status,conclusion,headBranch,url,updatedAt"
            ]
            runs_res = subprocess.run(runs_cmd, env=gh_env, capture_output=True, text=True, timeout=10)
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
# 2. MONGODB SUBCOMMANDS
# ==============================================================================

def cmd_mongo_ping(args: argparse.Namespace):
    """Test connection and ping server."""
    client = get_mongo_client()
    start = time.perf_counter()
    res = client.admin.command("ping")
    elapsed_ms = (time.perf_counter() - start) * 1000
    server_info = client.server_info()
    version = server_info.get("version", "unknown")
    print(c_ok(f"Connected to MongoDB Atlas successfully!"))
    print(f"  Latency: {elapsed_ms:.2f}ms")
    print(f"  Server Version: {version}")
    print(f"  Available Databases: {', '.join(client.list_database_names())}")

def cmd_mongo_list(args: argparse.Namespace):
    """List collections and doc counts for an environment."""
    client = get_mongo_client()
    db_name = resolve_db_name(args.env)
    db = client[db_name]
    colls = sorted(db.list_collection_names())

    print(c_bold(f"\nCollections in '{db_name}' ({len(colls)} total):"))
    print(f"{'Collection':<25} {'Doc Count':>12} {'Indexes':>10}")
    print("-" * 50)
    for c in colls:
        count = db[c].count_documents({})
        idx_count = len(db[c].index_information())
        print(f"{c:<25} {count:>12,} {idx_count:>10}")
    print()

def cmd_mongo_count(args: argparse.Namespace):
    """Compare document counts across prod and lower environments."""
    client = get_mongo_client()
    prod_db = client["zap_platform_prod"]
    lower_db = client["zap_platform_lower"]

    colls = sorted(set(prod_db.list_collection_names() + lower_db.list_collection_names()))
    print(c_bold("\nDocument Counts by Collection:"))
    print(f"{'Collection':<25} {'Production':>15} {'Lower (QA)':>15}")
    print("-" * 58)
    for c in colls:
        p_cnt = prod_db[c].count_documents({}) if c in prod_db.list_collection_names() else 0
        l_cnt = lower_db[c].count_documents({}) if c in lower_db.list_collection_names() else 0
        print(f"{c:<25} {p_cnt:>15,} {l_cnt:>15,}")
    print()

def cmd_mongo_query(args: argparse.Namespace):
    """Query documents with filtering, projection, limit, and sort."""
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

    results = list(cursor)
    # Convert ObjectIds to strings for clean JSON printing
    for doc in results:
        for k, v in list(doc.items()):
            if hasattr(v, "__str__") and type(v).__name__ in ("ObjectId", "datetime"):
                doc[k] = str(v)

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
    """Get single document by ID or slug."""
    client = get_mongo_client()
    db_name = resolve_db_name(args.env)
    db = client[db_name]
    coll = db[args.collection]

    query = None
    # Try ObjectId if valid 24-hex
    val = args.identifier
    from bson.objectid import ObjectId
    if len(val) == 24:
        try:
            query = {"_id": ObjectId(val)}
        except Exception:
            pass
    if not query:
        query = {"$or": [{"_id": val}, {"id": val}, {"slug": val}, {"userId": val}, {"email": val}]}

    doc = coll.find_one(query)
    if not doc:
        print(c_warn(f"No document found matching identifier '{args.identifier}' in {db_name}.{args.collection}"))
    else:
        print(json.dumps(doc, indent=2, default=str))

def cmd_mongo_schema(args: argparse.Namespace):
    """Analyze sample documents from a collection to infer schema."""
    client = get_mongo_client()
    db_name = resolve_db_name(args.env)
    db = client[db_name]
    coll = db[args.collection]

    docs = list(coll.find().limit(args.sample_size))
    if not docs:
        print(c_warn(f"Collection '{db_name}.{args.collection}' is empty."))
        return

    schema_types: dict[str, set[str]] = {}
    sample_values: dict[str, Any] = {}

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
    """List indexes on collections and verify required indexes."""
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

def cmd_mongo_sync_to_lower(args: argparse.Namespace):
    """Safely copy documents from zap_platform_prod to zap_platform_lower (one-way)."""
    client = get_mongo_client()
    source_db = client["zap_platform_prod"]
    target_db = client["zap_platform_lower"]
    coll_name = args.collection

    # Guardrails: strictly one-way, never write to prod
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
# 3. GCP SUBCOMMANDS
# ==============================================================================

def cmd_gcp_services(args: argparse.Namespace):
    """Inspect Cloud Run services."""
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
    print(f"{'Service':<16} {'Ready':<8} {'URL':<46} {'Active Revision':<26}")
    print("-" * 98)
    for svc in services:
        name = svc.get("metadata", {}).get("name", "")
        url = svc.get("status", {}).get("address", {}).get("url", "")
        conditions = svc.get("status", {}).get("conditions", [])
        ready = any(c.get("type") == "Ready" and c.get("status") == "True" for c in conditions)
        ready_str = c_ok("YES") if ready else c_err("NO")
        rev = svc.get("status", {}).get("latestReadyRevisionName", "")
        print(f"{name:<16} {ready_str:<17} {url:<46} {rev:<26}")
    print()

def cmd_gcp_tasks(args: argparse.Namespace):
    """Inspect Cloud Tasks queues."""
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
    """Fetch logs from Cloud Run services via gcloud logging."""
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


# ==============================================================================
# 4. GITHUB SUBCOMMANDS
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


# ==============================================================================
# MAIN PARSER ENTRYPOINT
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(
        prog="zap_ops",
        description="ZAP Cloud & Database Operations CLI: MongoDB Atlas, GCP Cloud Run/Tasks/Logs, and GitHub CI/CD."
    )
    subparsers = parser.add_subparsers(dest="command", help="Operational domain")

    # DOCTOR
    doc_parser = subparsers.add_parser("doctor", help="Run full platform health and diagnostic check across all services")
    doc_parser.add_argument("--project", default=DEFAULT_GCP_PROJECT, help="GCP Project ID")
    doc_parser.add_argument("--region", default=DEFAULT_GCP_REGION, help="GCP Region")
    doc_parser.set_defaults(func=cmd_doctor)

    # Status alias for doctor
    status_parser = subparsers.add_parser("status", help="Alias for doctor")
    status_parser.add_argument("--project", default=DEFAULT_GCP_PROJECT, help="GCP Project ID")
    status_parser.add_argument("--region", default=DEFAULT_GCP_REGION, help="GCP Region")
    status_parser.set_defaults(func=cmd_doctor)

    # MONGODB
    mongo_parser = subparsers.add_parser("mongo", help="MongoDB Atlas database queries and management")
    mongo_sub = mongo_parser.add_subparsers(dest="mongo_command", help="MongoDB action")

    # mongo ping
    m_ping = mongo_sub.add_parser("ping", help="Ping MongoDB cluster and measure latency")
    m_ping.set_defaults(func=cmd_mongo_ping)

    # mongo list
    m_list = mongo_sub.add_parser("list", help="List collections and doc counts for an environment")
    m_list.add_argument("--env", choices=["prod", "production", "lower", "qa"], default="prod", help="Target environment (default: prod)")
    m_list.set_defaults(func=cmd_mongo_list)

    # mongo count
    m_count = mongo_sub.add_parser("count", help="Compare document counts between prod and lower databases")
    m_count.set_defaults(func=cmd_mongo_count)

    # mongo query
    m_query = mongo_sub.add_parser("query", help="Query documents with JSON filter and field selection")
    m_query.add_argument("--env", choices=["prod", "production", "lower", "qa"], default="prod", help="Target environment")
    m_query.add_argument("--collection", "-c", required=True, help="Collection name (e.g. submissions, questions, users)")
    m_query.add_argument("--filter", "-f", default=None, help='JSON query filter (e.g. \'{"status": "QUEUED"}\')')
    m_query.add_argument("--fields", default=None, help="Comma-separated projection fields (e.g. 'slug,title,difficulty')")
    m_query.add_argument("--sort", default=None, help="Sort field and direction (e.g. 'createdAt:-1')")
    m_query.add_argument("--limit", "-n", type=int, default=5, help="Max documents to return (default: 5)")
    m_query.add_argument("--format", choices=["json", "table"], default="table", help="Output format (default: table)")
    m_query.set_defaults(func=cmd_mongo_query)

    # mongo get
    m_get = mongo_sub.add_parser("get", help="Get a single document by ID, slug, or email")
    m_get.add_argument("--env", choices=["prod", "production", "lower", "qa"], default="prod", help="Target environment")
    m_get.add_argument("--collection", "-c", required=True, help="Collection name")
    m_get.add_argument("identifier", help="ID (24-hex ObjectId, string ID, slug, or email)")
    m_get.set_defaults(func=cmd_mongo_get)

    # mongo schema
    m_schema = mongo_sub.add_parser("schema", help="Infer document fields and schema types from sample")
    m_schema.add_argument("--env", choices=["prod", "production", "lower", "qa"], default="prod", help="Target environment")
    m_schema.add_argument("--collection", "-c", required=True, help="Collection name")
    m_schema.add_argument("--sample-size", type=int, default=20, help="Number of documents to sample")
    m_schema.set_defaults(func=cmd_mongo_schema)

    # mongo indexes
    m_idx = mongo_sub.add_parser("indexes", help="List collection indexes and metadata")
    m_idx.add_argument("--env", choices=["prod", "production", "lower", "qa"], default="prod", help="Target environment")
    m_idx.add_argument("--collection", "-c", default=None, help="Optional collection name filter")
    m_idx.set_defaults(func=cmd_mongo_indexes)

    # mongo sync-to-lower
    m_sync = mongo_sub.add_parser("sync-to-lower", help="Safely sync documents from prod to lower (QA) database")
    m_sync.add_argument("--collection", "-c", required=True, help="Collection name (e.g. questions, mcq_questions, contests)")
    m_sync.add_argument("--filter", "-f", default=None, help="Optional JSON filter for source documents")
    m_sync.add_argument("--limit", type=int, default=None, help="Max documents to sync")
    m_sync.add_argument("--force", action="store_true", help="Force sync on large/sensitive collections")
    m_sync.set_defaults(func=cmd_mongo_sync_to_lower)

    # GCP
    gcp_parser = subparsers.add_parser("gcp", help="Google Cloud Platform operations (Cloud Run, Tasks, Logs, Secrets)")
    gcp_sub = gcp_parser.add_subparsers(dest="gcp_command", help="GCP action")

    # gcp services
    g_svc = gcp_sub.add_parser("services", help="Inspect Cloud Run services status and URLs")
    g_svc.add_argument("--project", default=DEFAULT_GCP_PROJECT, help="GCP Project ID")
    g_svc.add_argument("--region", default=DEFAULT_GCP_REGION, help="GCP Region")
    g_svc.set_defaults(func=cmd_gcp_services)

    # gcp tasks
    g_tasks = gcp_sub.add_parser("tasks", help="Inspect Cloud Tasks queues")
    g_tasks.add_argument("--project", default=DEFAULT_GCP_PROJECT, help="GCP Project ID")
    g_tasks.add_argument("--region", default=DEFAULT_GCP_REGION, help="GCP Region")
    g_tasks.set_defaults(func=cmd_gcp_tasks)

    # gcp queue-state
    g_qstate = gcp_sub.add_parser("queue-state", help="Pause or resume a Cloud Tasks queue")
    g_qstate.add_argument("queue", help="Queue name (e.g. zap-submissions-lower)")
    g_qstate.add_argument("action", choices=["pause", "resume"], help="Action to perform")
    g_qstate.add_argument("--confirm-prod", action="store_true", help="Explicit confirmation for production queue")
    g_qstate.add_argument("--project", default=DEFAULT_GCP_PROJECT, help="GCP Project ID")
    g_qstate.add_argument("--region", default=DEFAULT_GCP_REGION, help="GCP Region")
    g_qstate.set_defaults(func=cmd_gcp_queue_state)

    # gcp logs
    g_logs = gcp_sub.add_parser("logs", help="Fetch recent Cloud Run logs")
    g_logs.add_argument("--service", choices=["api", "executor", "zap-api", "zap-executor"], default="api", help="Service name")
    g_logs.add_argument("--severity", choices=["INFO", "WARNING", "ERROR", "CRITICAL"], default=None, help="Minimum log severity")
    g_logs.add_argument("--limit", type=int, default=20, help="Number of log entries (default: 20)")
    g_logs.add_argument("--search", default=None, help="Text substring search in payload")
    g_logs.add_argument("--project", default=DEFAULT_GCP_PROJECT, help="GCP Project ID")
    g_logs.set_defaults(func=cmd_gcp_logs)

    # gcp secrets
    g_sec = gcp_sub.add_parser("secrets", help="List Secret Manager secrets")
    g_sec.add_argument("--project", default=DEFAULT_GCP_PROJECT, help="GCP Project ID")
    g_sec.set_defaults(func=cmd_gcp_secrets)

    # GITHUB
    gh_parser = subparsers.add_parser("github", help="GitHub & CI/CD workflow operations")
    gh_sub = gh_parser.add_subparsers(dest="github_command", help="GitHub action")

    # github runs
    gh_runs = gh_sub.add_parser("runs", help="List recent workflow runs")
    gh_runs.add_argument("--repo", default="alendnl/zap", help="Repository (owner/repo)")
    gh_runs.add_argument("--limit", type=int, default=5, help="Number of runs to list")
    gh_runs.add_argument("--workflow", default=None, help="Workflow file or name (e.g. ci.yml)")
    gh_runs.set_defaults(func=cmd_github_runs)

    # github view
    gh_view = gh_sub.add_parser("view", help="View a specific workflow run and its logs")
    gh_view.add_argument("run_id", help="GitHub Actions run ID")
    gh_view.add_argument("--repo", default="alendnl/zap", help="Repository (owner/repo)")
    gh_view.add_argument("--failed-logs", action="store_true", help="Display failed step logs directly")
    gh_view.set_defaults(func=cmd_github_view)

    # github status
    gh_stat = gh_sub.add_parser("status", help="View repository status and metadata")
    gh_stat.add_argument("--repo", default="alendnl/zap", help="Repository (owner/repo)")
    gh_stat.set_defaults(func=cmd_github_status)

    args = parser.parse_args()
    if not hasattr(args, "func"):
        parser.print_help()
        sys.exit(1)

    args.func(args)

if __name__ == "__main__":
    main()
