#!/usr/bin/env python3
"""
Dynamic Runtime Website Inventory Generator.
Generates an ephemeral, structured Markdown or JSON inventory matrix for the agent's active session.
Never commits a permanent hardcoded route list into repository codebase.

Status Lifecycle:
- Discovery Status: Discovered (Source Code) | Discovered (Browser Observed)
- Verification Status: Discovered | Visited | Verified | Inaccessible / Gated | Error / Broken
"""

import sys
import json
import argparse
from pathlib import Path
from typing import Dict, Any, List

def create_inventory_template(discovery_data: Dict[str, Any], base_url: str = "http://localhost:3000") -> str:
    routes = discovery_data.get("routes", [])
    fw = discovery_data.get("framework_info", {}).get("framework", "Web App")

    lines = [
        f"# Ephemeral Runtime Website Inventory",
        f"> **Notice**: Generated dynamically at runtime. This is an ephemeral working artifact, not a permanent hardcoded manifest.",
        f"",
        f"- **Framework**: `{fw}`",
        f"- **Base URL**: `{base_url}`",
        f"- **Total Discovered Routes**: `{len(routes)}`",
        f"- **Discovery Mode**: Dual-Track (Source AST + Browser Exploration)",
        f"",
        f"## Route Verification Matrix",
        f"",
        f"| # | Route URL | Page Purpose | Key Layout / Components | Auth Requirement | Discovery Status | Browser Verification Status | Notes / Interactions |",
        f"| :- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |"
    ]

    for idx, r in enumerate(routes, 1):
        url = r.get("url", "/")
        purpose = r.get("purpose", "Application View")
        layout = r.get("layout", "Default")
        auth = r.get("auth_level", "Public")
        disc_status = "Discovered (Source)"
        verif_status = "Discovered"  # default initial state

        lines.append(
            f"| {idx} | `{url}` | {purpose} | `{layout}` | {auth} | {disc_status} | **{verif_status}** | Initial discovery pending browser visit |"
        )

    lines.extend([
        f"",
        f"## Verification Status Key",
        f"- **Discovered**: Route identified via static code or link discovery; pending browser navigation.",
        f"- **Visited**: Page opened in browser subagent; rendered DOM observed.",
        f"- **Verified**: Visually and functionally validated across target viewports without console/network errors.",
        f"- **Inaccessible / Gated**: Requires credentials, elevated role, or specific session state.",
        f"- **Error / Broken**: Encountered 404, 500, crash, or severe visual overflow.",
        f"",
        f"> **Rule**: Never claim complete website coverage when only a subset of routes has been verified."
    ])

    return "\n".join(lines)

def main():
    parser = argparse.ArgumentParser(description="Generate ephemeral runtime website inventory")
    parser.add_argument("--json-input", type=str, help="Path to discovery JSON or omit to read from stdin")
    parser.add_argument("--base-url", type=str, default="http://localhost:3000", help="Application base URL")
    parser.add_argument("--out", type=str, help="Optional output file path")
    args = parser.parse_args()

    if args.json_input:
        with open(args.json_input, "r", encoding="utf-8") as f:
            data = json.load(f)
    elif not sys.stdin.isatty():
        data = json.load(sys.stdin)
    else:
        # Import and run discover_routes dynamically
        from discover_routes import scan_codebase_routes, detect_project_roots
        roots = detect_project_roots(Path("."))
        target_root = roots[0] if roots else Path(".")
        data = scan_codebase_routes(target_root)

    # Handle list or dict
    if isinstance(data, list):
        data = data[0]

    output_md = create_inventory_template(data, base_url=args.base_url)

    if args.out:
        Path(args.out).write_text(output_md, encoding="utf-8")
        print(f"Inventory saved to {args.out}")
    else:
        print(output_md)

if __name__ == "__main__":
    main()
