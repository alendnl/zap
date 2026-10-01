# ZAP — Local Development Setup Guide

This guide walks you through setting up and running the full **ZAP** (DSA & Interview Preparation Platform) development environment locally on macOS, Linux, or Windows (WSL2).

---

## 📋 Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Repository Structure](#2-repository-structure)
3. [Backend Setup (ZAP-BE)](#3-backend-setup-zap-be)
4. [Frontend Setup (ZAP-FE)](#4-frontend-setup-zap-fe)
5. [Running the Full Stack](#5-running-the-full-stack)
6. [Testing & Verification](#6-testing--verification)
7. [Optional: Local Docker Sandbox Execution](#7-optional-local-docker-sandbox-execution)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Prerequisites

Ensure you have the following installed on your host machine:

| Tool | Recommended Version | Verify Command |
|---|---|---|
| **Python** | 3.11, 3.12, 3.13, or 3.14 | `python3 --version` |
| **Node.js** | 20.x or 22.x LTS | `node --version` |
| **npm** | 10.x or higher | `npm --version` |
| **Git** | 2.40+ | `git --version` |
| **Docker** *(Optional)* | 24+ | `docker --version` |

> [!NOTE]
> MongoDB is **optional** for local development. By default, the application and tests fall back automatically to an in-memory mock engine (`mongomock`), allowing immediate zero-configuration startup.

---

## 2. Repository Structure

```text
zap/
├── ZAP-BE/                   # FastAPI Backend & Compiler Execution Engine
│   ├── app/
│   │   ├── config.py         # Pydantic environment settings
│   │   ├── main.py           # FastAPI entrypoint & router registry
│   │   ├── db/mongodb.py     # Database client & dependency injector
│   │   ├── questions/        # Question CRUD router, models, service
│   │   └── submissions/      # Submissions API router, queue, models
│   ├── executor/             # Decoupled Compiler Execution Engine
│   │   ├── core/             # Runner protocols & execution contracts
│   │   ├── sandbox/          # Process containment, timeouts, limits
│   │   ├── languages/        # Python, Node.js, Java, C++ runners
│   │   ├── judge/            # Test-case evaluation & verdict engine
│   │   └── worker/           # Async queue consumer
│   ├── tests/                # Pytest unit & integration test suites
│   └── requirements.txt      # Python dependencies
│
├── ZAP-FE/                   # Next.js 15 + React 19 Frontend
│   ├── src/
│   │   ├── app/              # Next.js App Router (Student & Faculty pages)
│   │   ├── components/       # Monaco Editor, QuestionPane, Workspace
│   │   ├── services/         # API clients for Questions & Submissions
│   │   └── types/            # TypeScript interfaces
│   ├── package.json          # Node dependencies & scripts
│   └── tailwind.config.js    # Tailwind CSS styling configuration
│
├── docs/                     # Architecture, specifications & setup guides
├── .agents/                  # Agent skills & automated build scripts
└── .github/workflows/        # CI/CD pipelines
```

---

## 3. Backend Setup (ZAP-BE)

### Step 3.1: Create and Activate Python Virtual Environment

From the root of the repository:

```bash
# Create virtual environment named .venv
python3 -m venv .venv

# Activate on macOS / Linux:
source .venv/bin/activate

# Or on Windows (PowerShell):
# .venv\Scripts\Activate.ps1
```

### Step 3.2: Install Python Dependencies

```bash
pip install --upgrade pip
pip install -r ZAP-BE/requirements.txt
```

### Step 3.3: Environment Configuration (Optional)

Create a `.env` file inside `ZAP-BE/` if you want to override default settings:

```bash
# ZAP-BE/.env
APP_NAME="ZAP Backend"
ENVIRONMENT="development"
DEBUG=true

# Database (Leave as is for local mongomock fallback, or point to local MongoDB)
MONGODB_URI="mongodb://localhost:27017"
DATABASE_NAME="zap_db"

# Execution Resource Limits
MAX_EXECUTION_TIME_SECONDS=5.0
MAX_MEMORY_MB=512
MAX_OUTPUT_BYTES=1048576
```

### Step 3.4: Start the Backend Server

```bash
cd ZAP-BE
uvicorn app.main:app --reload --port 8000
```

Verify backend health:
- **Interactive Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Documentation**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Endpoint**: [http://localhost:8000/health](http://localhost:8000/health)

Expected response from `/health`:
```json
{
  "status": "healthy",
  "service": "ZAP-BE",
  "environment": "development"
}
```

---

## 4. Frontend Setup (ZAP-FE)

Open a new terminal window.

### Step 4.1: Install Node Dependencies

```bash
cd ZAP-FE
npm install
```

### Step 4.2: Configure Environment Variables

Create `.env.local` inside `ZAP-FE/`:

```bash
cat << 'EOF' > ZAP-FE/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
EOF
```

### Step 4.3: Start the Next.js Development Server

```bash
cd ZAP-FE
npm run dev
```

The frontend will start at [http://localhost:3000](http://localhost:3000).

---

## 5. Running the Full Stack

With both servers running:

1. **Student Problem Workspace**: Open [http://localhost:3000](http://localhost:3000)
   - View problem statements, constraints, and sample inputs/outputs.
   - Select programming language: **Python 3.14**, **Java 21**, **C++ 23**, or **Node.js 22.8**.
   - Edit code in the Monaco Editor.
   - Click **Run Code** to test against sample cases or **Submit** to execute against all test cases.
   - Watch real-time execution verdicts (`QUEUED` → `RUNNING` → `ACCEPTED` / `WRONG_ANSWER` / `COMPILE_ERROR`).

2. **Faculty Question Portal**: Open [http://localhost:3000/faculty/questions](http://localhost:3000/faculty/questions)
   - Browse existing questions with tags, difficulty badges, and test case counts.
   - Click **+ New Question** ([http://localhost:3000/faculty/questions/new](http://localhost:3000/faculty/questions/new)).
   - Add problem statements, test cases (marked `PUBLIC` or `HIDDEN`), and execution limits.
   - Use the **Import from JSON** tool to paste and preview questions in bulk.

---

## 6. Testing & Verification

### Run Backend Unit & Integration Tests

From the workspace root with virtual environment activated:

```bash
pytest -v
```

This executes all 13 test suites covering:
- Question CRUD API (`tests/test_questions.py`)
- Compiler submission API & state machine (`tests/test_submissions.py`)
- Language runners (Python, Java, C++, Node.js) and Sandbox isolation (`tests/test_runners.py`)
- Judge engine evaluation & queue worker (`tests/test_judge.py`)

### Run Automated Build & Conflict Verification Script

We provide an automated verification script that executes backend tests, frontend builds, and conflict marker scans:

```bash
./.agents/skills/build-issue/scripts/verify_build.sh
```

---

## 7. Optional: Local Docker Sandbox Execution

For full compiler isolation mirroring production:

1. Build the local executor runner container:
   ```bash
   docker build -t zap-runner:local -f ZAP-BE/Dockerfile.worker ZAP-BE/
   ```

2. Run tests inside the isolated container:
   ```bash
   docker run --rm -v $(pwd)/ZAP-BE:/app -w /app zap-runner:local pytest -v
   ```

---

## 8. Troubleshooting

| Symptom | Cause | Solution |
|---|---|---|
| `ModuleNotFoundError: No module named 'app'` | Running pytest from inside `ZAP-BE/` without `PYTHONPATH` | Run `pytest` from the **project root**, or execute `export PYTHONPATH=$PYTHONPATH:$(pwd)/ZAP-BE`. |
| `TypeError: BaseModel.__init_subclass__()` | Incompatible Pydantic version | Ensure `pydantic>=2.6.0` and `pydantic-settings>=2.2.0` are installed: `pip install -r ZAP-BE/requirements.txt`. |
| Monaco Editor shows blank or loading spinner | Server-Side Rendering (SSR) conflict in Next.js | Monaco is dynamically loaded with `{ ssr: false }`. Ensure browser JavaScript is enabled and check dev console. |
| CORS error in browser console | Frontend origin blocked by FastAPI | Verify `ZAP-BE/app/main.py` has `CORSMiddleware` configured (enabled by default for all origins in development). |
| Port 8000 or 3000 already in use | Stale process running | Free ports: `kill -9 $(lsof -ti:8000)` or change port: `uvicorn app.main:app --port 8001`. |
