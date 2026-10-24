# ZAP Local Development Setup Guide

Get the complete ZAP stack running locally on macOS, Linux, or WSL2.

---

## 1. Prerequisites

- **Python**: 3.11+ (Python 3.14 recommended)
- **Node.js**: 20.x or 22.x LTS
- **npm**: 10.x+
- **Compilers** (for local code execution): `gcc` / `g++` (C/C++), `javac` / `java` (Java 21).

> [!NOTE]
> MongoDB and GCP Cloud Tasks are **NOT required** for local development. By default, the application and tests fall back automatically to an in-memory database (`mongomock`) and an in-memory task queue (`MemorySubmissionQueue`).

---

## 2. Backend Setup (`ZAP-BE`)

### 2.1 Virtual Environment & Dependencies
```bash
# From workspace root
python3 -m venv .venv
source .venv/bin/activate
pip install -r ZAP-BE/requirements.txt
```

### 2.2 Run Backend Server
```bash
cd ZAP-BE
uvicorn app.main:app --reload --port 8000
```
- API Documentation (Swagger): `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### 2.3 Run Backend Tests
```bash
# From repository root
.venv/bin/pytest -v ZAP-BE
```

---

## 3. Frontend Setup (`ZAP-FE`)

### 3.1 Install Dependencies
```bash
# From workspace root
npm install
```

### 3.2 Run Frontend Development Server
```bash
npm run dev --workspace=ZAP-FE
```
- Student Arena: `http://localhost:3000`
- Faculty Question Manager: `http://localhost:3000/faculty/questions`

### 3.3 Build Verification
```bash
npm run build --workspace=ZAP-FE
```

---

## 4. Full-Stack Verification Script

Run the automated verification script from the `build` skill to validate both Python tests, TypeScript compilation, and conflict detection:

```bash
.agents/skills/build/scripts/verify_build.sh
```
