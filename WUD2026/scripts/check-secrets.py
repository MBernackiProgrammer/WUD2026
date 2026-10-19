"""Small offline source check. Prints locations only, never credential values.

Usage: python scripts/check-secrets.py [parent-directory-containing-the-three-projects]
Runtime .env files are intentionally ignored; they must be supplied outside source control.
"""
from pathlib import Path
import json
import os
import re
import sys

root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[2]
ignored = {"node_modules", ".angular", ".git", "bin", "obj", "dist", "Backups", "TestResults"}
extensions = {".json", ".yaml", ".yml", ".ts", ".js", ".mjs", ".cs", ".md", ".txt", ".ps1", ".sh", ".config"}
patterns = [
    re.compile(r"sk-(?:proj-)?[A-Za-z0-9_-]{24,}"),
    re.compile(r"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----"),
]
issues = []
for directory, dirs, files in os.walk(root):
    dirs[:] = [name for name in dirs if name not in ignored]
    for name in files:
        path = Path(directory) / name
        if path.suffix.lower() not in extensions or path.stat().st_size > 15_000_000:
            continue
        try:
            text = path.read_text(encoding="utf-8-sig")
        except (UnicodeDecodeError, OSError):
            continue
        if any(pattern.search(text) for pattern in patterns):
            issues.append((path, "embedded key material"))
        if re.fullmatch(r"appsettings(?:\.[\w.-]+)?\.json", name, re.IGNORECASE):
            try:
                if json.loads(text) != {}:
                    issues.append((path, "operational settings must be provided by environment"))
            except json.JSONDecodeError:
                issues.append((path, "invalid configuration JSON"))
for path, reason in issues:
    print(f"{path.relative_to(root)}: {reason}")
print(f"Secret hygiene: {'FAIL' if issues else 'PASS'} ({len(issues)} findings).")
sys.exit(1 if issues else 0)
