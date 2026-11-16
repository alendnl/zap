#!/usr/bin/env python3
"""
Dynamic Website Route Discovery Tool for Google Antigravity Universal Website Interaction Skill.
Framework-agnostic, zero-external-dependencies scanner for modern frontend web applications.

Supported Frameworks:
- Next.js (App Router & Pages Router)
- React Router / Remix / Vite SPA
- SvelteKit (+page.svelte)
- Vue / Nuxt (pages/**/*.vue & vue-router)
- Astro (src/pages/**/*.{astro,md,mdx})
- Static / Vanilla HTML
"""

import os
import sys
import json
import re
import argparse
from pathlib import Path
from typing import List, Dict, Any, Optional

IGNORED_DIRS = {
    ".git", ".venv", "node_modules", ".next", "dist", "build",
    ".agents", ".agent", ".gemini", "brain", ".turbo", ".cache"
}

FRONTEND_SUBDIR_CANDIDATES = [
    "ZAP-FE", "frontend", "client", "web", "ui", "app", "apps/web",
    "apps/frontend", "packages/web", "packages/frontend"
]

def detect_project_roots(base_dir: Path) -> List[Path]:
    """Identify directories containing frontend projects, taking monorepos and workspaces into account."""
    roots = []

    # 1. Check root package.json for npm/yarn/pnpm workspaces
    root_pkg = base_dir / "package.json"
    if root_pkg.exists():
        try:
            with open(root_pkg, "r", encoding="utf-8") as f:
                data = json.load(f)
                workspaces = data.get("workspaces", [])
                if isinstance(workspaces, list):
                    for ws in workspaces:
                        # Handle wildcard e.g. "apps/*"
                        if ws.endswith("/*"):
                            parent = base_dir / ws[:-2]
                            if parent.is_dir():
                                for child in parent.iterdir():
                                    if child.is_dir() and (child / "package.json").exists():
                                        roots.append(child)
                        else:
                            ws_path = base_dir / ws
                            if ws_path.is_dir():
                                roots.append(ws_path)
                elif isinstance(workspaces, dict):
                    # Yarn workspaces object with packages array
                    for ws in workspaces.get("packages", []):
                        ws_path = base_dir / ws
                        if ws_path.is_dir():
                            roots.append(ws_path)
        except Exception:
            pass

    if roots:
        return roots

    # 2. Check candidates
    for sub in FRONTEND_SUBDIR_CANDIDATES:
        p = base_dir / sub
        if p.is_dir() and ((p / "package.json").exists() or (p / "src").exists() or (p / "app").exists()):
            roots.append(p)

    # 3. Check if base_dir itself has routing indicators
    if not roots:
        if (base_dir / "src/app").exists() or (base_dir / "src/pages").exists() or (base_dir / "app").exists() or (base_dir / "pages").exists():
            roots.append(base_dir)
        elif (base_dir / "package.json").exists():
            roots.append(base_dir)
        else:
            roots.append(base_dir)

    return roots

def detect_framework(project_root: Path) -> Dict[str, Any]:
    """Detect frontend framework and routing paradigm from package.json and file structure."""
    package_json = project_root / "package.json"
    deps = {}
    scripts = {}
    if package_json.exists():
        try:
            with open(package_json, "r", encoding="utf-8") as f:
                data = json.load(f)
                deps.update(data.get("dependencies", {}))
                deps.update(data.get("devDependencies", {}))
                scripts.update(data.get("scripts", {}))
        except Exception:
            pass

    info = {
        "framework": "unknown",
        "routing_type": "unknown",
        "dev_command": scripts.get("dev", "npm run dev"),
        "build_command": scripts.get("build", "npm run build"),
        "has_tailwind": "tailwindcss" in deps,
        "is_typescript": (project_root / "tsconfig.json").exists() or "typescript" in deps,
        "dependencies": list(deps.keys())
    }

    # Next.js
    if "next" in deps or (project_root / "next.config.js").exists() or (project_root / "next.config.mjs").exists() or (project_root / "next.config.ts").exists():
        info["framework"] = "Next.js"
        if (project_root / "src/app").exists() or (project_root / "app").exists():
            info["routing_type"] = "App Router"
        elif (project_root / "src/pages").exists() or (project_root / "pages").exists():
            info["routing_type"] = "Pages Router"
        else:
            info["routing_type"] = "Next.js (Hybrid/Default)"
        return info

    # SvelteKit
    if "@sveltejs/kit" in deps or (project_root / "svelte.config.js").exists():
        info["framework"] = "SvelteKit"
        info["routing_type"] = "File-based (+page.svelte)"
        return info

    # Nuxt
    if "nuxt" in deps or "nuxt3" in deps or (project_root / "nuxt.config.ts").exists() or (project_root / "nuxt.config.js").exists():
        info["framework"] = "Nuxt"
        info["routing_type"] = "File-based (pages/)"
        return info

    # Astro
    if "astro" in deps or (project_root / "astro.config.mjs").exists():
        info["framework"] = "Astro"
        info["routing_type"] = "File-based (src/pages/)"
        return info

    # React Router / Remix
    if "react-router" in deps or "react-router-dom" in deps or "@remix-run/react" in deps:
        info["framework"] = "React (React Router / Remix)"
        info["routing_type"] = "Code / Config Router"
        return info

    # Vue
    if "vue" in deps:
        info["framework"] = "Vue"
        info["routing_type"] = "Vue Router / SPA"
        return info

    # React SPA
    if "react" in deps:
        info["framework"] = "React SPA"
        info["routing_type"] = "SPA Router"
        return info

    # Static HTML fallback
    html_files = [p for p in project_root.glob("*.html") if not any(x in p.parts for x in IGNORED_DIRS)]
    if html_files:
        info["framework"] = "Static HTML"
        info["routing_type"] = "HTML Files"
        return info

    return info

def analyze_auth_and_guards(file_path: Path) -> List[str]:
    """Scan file content for auth guards, tokens, roles, and protection patterns."""
    hints = []
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return hints

    patterns = [
        (r"(?:admin|faculty|role|permission|requireAuth|protectedRoute|isFaculty|isAdmin)", "Role-Gated"),
        (r"(?:getStoredStudent|useAuth|isAuthenticated|token|session|authApi)", "Auth-Required"),
        (r"(?:router\.replace\(['\"]\/login|redirect\(['\"]\/login)", "Redirects-to-Login"),
        (r"(?:ThemeContext|ThemeProvider|ThemeToggle)", "Theme-Aware"),
    ]

    for pat, label in patterns:
        if re.search(pat, content, re.IGNORECASE):
            if label not in hints:
                hints.append(label)

    return hints

def extract_page_purpose(file_path: Path) -> str:
    """Infer page purpose from title, comments, or exported function name."""
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
        # Check metadata title
        meta_match = re.search(r'title:\s*["\']([^"\']+)["\']', content)
        if meta_match:
            return meta_match.group(1).strip()

        # Check export default function Name
        fn_match = re.search(r'export\s+default\s+function\s+([A-Za-z0-9_]+)', content)
        if fn_match:
            name = fn_match.group(1)
            # Convert PascalCase to title
            return re.sub(r'([a-z])([A-Z])', r'\1 \2', name)
    except Exception:
        pass
    return "Application View"

def discover_nextjs_app_routes(app_dir: Path, project_root: Path) -> List[Dict[str, Any]]:
    """Discover all routes in Next.js App Router directory."""
    routes = []
    page_patterns = ["page.tsx", "page.jsx", "page.js", "page.ts"]

    for pattern in page_patterns:
        for page_file in app_dir.rglob(pattern):
            if any(ign in page_file.parts for ign in IGNORED_DIRS):
                continue
            rel_to_app = page_file.parent.relative_to(app_dir)
            parts = rel_to_app.parts

            url_segments = []
            has_dynamic = False
            dynamic_params = []
            route_groups = []

            for part in parts:
                if part.startswith("(") and part.endswith(")"):
                    route_groups.append(part)
                    continue
                if part.startswith("@"):
                    continue
                if part.startswith("[") and part.endswith("]"):
                    has_dynamic = True
                    param_name = part.strip("[]")
                    dynamic_params.append(param_name)
                    url_segments.append(f":{param_name}")
                else:
                    url_segments.append(part)

            url_path = "/" + "/".join(url_segments) if url_segments else "/"

            layout_file = None
            curr = page_file.parent
            while curr >= app_dir:
                for lp in ["layout.tsx", "layout.jsx", "layout.js", "layout.ts"]:
                    if (curr / lp).exists():
                        layout_file = str((curr / lp).relative_to(project_root))
                        break
                if layout_file:
                    break
                curr = curr.parent

            hints = analyze_auth_and_guards(page_file)
            purpose = extract_page_purpose(page_file)
            auth_level = "Public"
            if "Role-Gated" in hints:
                auth_level = "Admin / Role Protected"
            elif "Auth-Required" in hints or "Redirects-to-Login" in hints:
                auth_level = "User Auth Required"

            routes.append({
                "url": url_path,
                "file": str(page_file.relative_to(project_root)),
                "purpose": purpose,
                "framework": "Next.js App Router",
                "layout": layout_file or "RootLayout",
                "dynamic": has_dynamic,
                "params": dynamic_params,
                "route_groups": route_groups,
                "auth_level": auth_level,
                "hints": hints
            })

    routes.sort(key=lambda r: (len(r["url"].split("/")), r["url"]))
    return routes

def discover_nextjs_pages_routes(pages_dir: Path, project_root: Path) -> List[Dict[str, Any]]:
    """Discover all routes in Next.js Pages Router directory."""
    routes = []
    extensions = {".tsx", ".jsx", ".js", ".ts"}

    for item in pages_dir.rglob("*"):
        if any(ign in item.parts for ign in IGNORED_DIRS):
            continue
        if item.is_file() and item.suffix in extensions:
            rel = item.relative_to(pages_dir)
            parts = list(rel.parts)
            filename = parts[-1]

            if filename.startswith("_") or (parts and parts[0] == "api"):
                continue

            stem = item.stem
            url_segments = parts[:-1]
            if stem != "index":
                url_segments.append(stem)

            cleaned_segments = []
            has_dynamic = False
            dynamic_params = []
            for seg in url_segments:
                if seg.startswith("[") and seg.endswith("]"):
                    has_dynamic = True
                    param = seg.strip("[]")
                    dynamic_params.append(param)
                    cleaned_segments.append(f":{param}")
                else:
                    cleaned_segments.append(seg)

            url_path = "/" + "/".join(cleaned_segments) if cleaned_segments else "/"
            hints = analyze_auth_and_guards(item)
            purpose = extract_page_purpose(item)
            auth_level = "Admin / Role Protected" if "Role-Gated" in hints else ("User Auth Required" if "Auth-Required" in hints else "Public")

            routes.append({
                "url": url_path,
                "file": str(item.relative_to(project_root)),
                "purpose": purpose,
                "framework": "Next.js Pages Router",
                "layout": "_app",
                "dynamic": has_dynamic,
                "params": dynamic_params,
                "auth_level": auth_level,
                "hints": hints
            })

    routes.sort(key=lambda r: (len(r["url"].split("/")), r["url"]))
    return routes

def discover_sveltekit_routes(routes_dir: Path, project_root: Path) -> List[Dict[str, Any]]:
    """Discover SvelteKit +page.svelte routes."""
    routes = []
    for item in routes_dir.rglob("+page.svelte"):
        if any(ign in item.parts for ign in IGNORED_DIRS):
            continue
        rel = item.parent.relative_to(routes_dir)
        parts = rel.parts
        url_segments = []
        has_dynamic = False
        dynamic_params = []

        for part in parts:
            if part.startswith("(") and part.endswith(")"):
                continue
            if part.startswith("[") and part.endswith("]"):
                has_dynamic = True
                param = part.strip("[]")
                dynamic_params.append(param)
                url_segments.append(f":{param}")
            else:
                url_segments.append(part)

        url_path = "/" + "/".join(url_segments) if url_segments else "/"
        routes.append({
            "url": url_path,
            "file": str(item.relative_to(project_root)),
            "purpose": extract_page_purpose(item),
            "framework": "SvelteKit",
            "layout": "+layout.svelte",
            "dynamic": has_dynamic,
            "params": dynamic_params,
            "auth_level": "Public",
            "hints": analyze_auth_and_guards(item)
        })
    return routes

def discover_vue_nuxt_routes(pages_dir: Path, project_root: Path) -> List[Dict[str, Any]]:
    """Discover Nuxt / Vue pages/*.vue routes."""
    routes = []
    for item in pages_dir.rglob("*.vue"):
        if any(ign in item.parts for ign in IGNORED_DIRS):
            continue
        rel = item.relative_to(pages_dir)
        parts = list(rel.parts)
        stem = item.stem
        url_segments = parts[:-1]
        if stem != "index":
            url_segments.append(stem)

        url_path = "/" + "/".join(url_segments) if url_segments else "/"
        routes.append({
            "url": url_path,
            "file": str(item.relative_to(project_root)),
            "purpose": extract_page_purpose(item),
            "framework": "Nuxt / Vue",
            "layout": "default",
            "dynamic": "_" in stem or "[" in stem,
            "params": [],
            "auth_level": "Public",
            "hints": analyze_auth_and_guards(item)
        })
    return routes

def discover_static_html_routes(project_root: Path) -> List[Dict[str, Any]]:
    """Discover plain static HTML pages while ignoring build/node_modules/skills dirs."""
    routes = []
    for html_file in project_root.rglob("*.html"):
        rel = html_file.relative_to(project_root)
        if any(p in IGNORED_DIRS for p in rel.parts):
            continue

        url_path = "/" + str(rel).replace("\\", "/")
        if html_file.name == "index.html":
            parent = str(rel.parent).replace("\\", "/")
            url_path = "/" if parent == "." else f"/{parent}"

        routes.append({
            "url": url_path,
            "file": str(rel),
            "purpose": extract_page_purpose(html_file),
            "framework": "Static HTML",
            "layout": "None",
            "dynamic": False,
            "params": [],
            "auth_level": "Public",
            "hints": []
        })
    return routes

def scan_codebase_routes(project_root: Path) -> Dict[str, Any]:
    """Scan the project root and extract all routes dynamically."""
    meta = detect_framework(project_root)
    routes = []

    # 1. Next.js App Router
    app_candidates = [project_root / "src/app", project_root / "app"]
    for app_dir in app_candidates:
        if app_dir.is_dir():
            routes.extend(discover_nextjs_app_routes(app_dir, project_root))
            break

    # 2. Next.js Pages Router
    pages_candidates = [project_root / "src/pages", project_root / "pages"]
    for pages_dir in pages_candidates:
        if pages_dir.is_dir():
            routes.extend(discover_nextjs_pages_routes(pages_dir, project_root))
            break

    # 3. SvelteKit
    svelte_routes = project_root / "src/routes"
    if svelte_routes.is_dir():
        routes.extend(discover_sveltekit_routes(svelte_routes, project_root))

    # 4. Vue / Nuxt
    nuxt_pages = [project_root / "pages", project_root / "src/pages"]
    for np in nuxt_pages:
        if np.is_dir() and (meta["framework"] in ("Nuxt", "Vue")):
            routes.extend(discover_vue_nuxt_routes(np, project_root))

    # 5. Static HTML if no routes found
    if not routes:
        routes.extend(discover_static_html_routes(project_root))

    return {
        "project_root": str(project_root.resolve()),
        "framework_info": meta,
        "total_routes": len(routes),
        "routes": routes
    }

def format_markdown(result: Dict[str, Any]) -> str:
    """Format discovery results as clean Markdown documentation."""
    meta = result["framework_info"]
    lines = [
        f"# Dynamic Website Route Discovery",
        f"",
        f"- **Project Root**: `{result['project_root']}`",
        f"- **Framework Detected**: {meta['framework']} ({meta['routing_type']})",
        f"- **TypeScript**: {'Yes' if meta['is_typescript'] else 'No'}",
        f"- **Tailwind CSS**: {'Detected' if meta['has_tailwind'] else 'Not detected'}",
        f"- **Total Discovered Routes**: `{result['total_routes']}`",
        f"",
        f"| Route URL | Component File | Page / Purpose | Auth Level | Layout | Params / Hints |",
        f"| :--- | :--- | :--- | :--- | :--- | :--- |"
    ]

    for r in result["routes"]:
        hints_str = ", ".join(r.get("hints", [])) or "None"
        params_str = f"Params: `[{', '.join(r['params'])}]`" if r.get("params") else ""
        notes = f"{params_str} {hints_str}".strip()
        purpose = r.get("purpose", "Application View")
        lines.append(f"| `{r['url']}` | `{r['file']}` | {purpose} | {r['auth_level']} | `{r['layout']}` | {notes} |")

    return "\n".join(lines)

def main():
    parser = argparse.ArgumentParser(description="Universal Website Route Discovery Scanner")
    parser.add_argument("--root", type=str, default=".", help="Root directory of repository or frontend")
    parser.add_argument("--format", choices=["markdown", "json", "summary"], default="markdown", help="Output format")
    args = parser.parse_args()

    base_path = Path(args.root).resolve()
    project_roots = detect_project_roots(base_path)

    all_results = []
    for root in project_roots:
        res = scan_codebase_routes(root)
        if res["total_routes"] > 0:
            all_results.append(res)

    if not all_results:
        all_results = [scan_codebase_routes(base_path)]

    if args.format == "json":
        print(json.dumps(all_results if len(all_results) > 1 else all_results[0], indent=2))
    elif args.format == "summary":
        for r in all_results:
            print(f"Framework: {r['framework_info']['framework']} | Routes: {r['total_routes']}")
            for route in r["routes"]:
                print(f"  {route['url']} ({route['auth_level']}) -> {route['file']}")
    else:
        for r in all_results:
            print(format_markdown(r))
            print("\n---\n")

if __name__ == "__main__":
    main()
