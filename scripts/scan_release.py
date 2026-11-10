"""Inspect a source/distribution tree without printing matched secret values."""

import argparse
from pathlib import Path
import re
import sys

IGNORE = {".git", ".cache", "dist", "__pycache__", "test-output"}
DATA_NAMES = {"Cookies", "Login Data", "History"}
DATA_SUFFIXES = {".gguf", ".safetensors", ".sqlite", ".db", ".log"}
PATTERNS = {
    "GitHub token": re.compile(rb"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{60,})"),
    "private key": re.compile(
        rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=]{32,}\r?\n[A-Za-z0-9+/=]{32,}"
    ),
    "cloud credential": re.compile(rb"\bAKIA[A-Z0-9]{16}\b"),
}


def scan(root, deny):
    issues = []
    count = 0
    needles = [
        (term.lower().encode(enc), "private deny-list term")
        for term in deny
        for enc in ("utf-8", "utf-16le")
        if term
    ]
    for p in sorted(root.rglob("*")):
        rel = p.relative_to(root)
        # Ignore only the project's own build/cache folders. Dependency folders
        # named dist inside a release must still be scanned.
        if rel.parts[0] in IGNORE or "__pycache__" in rel.parts or not p.is_file():
            continue
        count += 1
        if p.is_symlink():
            issues.append((str(rel), "unexpected symlink"))
            continue
        if is_data_file(p):
            issues.append((str(rel), "data/cache file"))
        if any(part.lower() in {"venv", ".venv"} for part in rel.parts[:-1]):
            issues.append((str(rel), "virtual environment file"))
        content = p.read_bytes()
        lower = content.lower()
        for needle, label in needles:
            if needle in lower:
                issues.append((str(rel), label))
                break
        for label, pattern in PATTERNS.items():
            if pattern.search(content):
                # Crypto dependency tests may contain deliberately public fixtures.
                # Review each hit; this scanner never silently ignores them.
                issues.append((str(rel), label))
    return count, issues


def is_data_file(path):
    """Vaults, browser data, model weights, logs, and .env-style secret files."""
    name = path.name
    lower = name.lower()
    return (
        name.startswith("vault.dshenc")
        or name in DATA_NAMES
        or lower == ".env"
        or lower.startswith(".env.")
        or lower.endswith(".env")
        or path.suffix.lower() in DATA_SUFFIXES
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("folder", type=Path)
    parser.add_argument("--deny-file", type=Path)
    args = parser.parse_args()
    deny = args.deny_file.read_text(encoding="utf-8-sig").splitlines() if args.deny_file else []
    count, issues = scan(args.folder.resolve(), deny)
    for file, label in issues:
        print(f"{label}: {file}")
    print(f"Checked {count} files; {len(issues)} findings.")
    sys.exit(bool(issues))
