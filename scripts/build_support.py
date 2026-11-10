"""Deterministic, path-free manifests for pinned inputs and portable outputs."""

from pathlib import Path
import hashlib
import json
import os
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def native(path):
    value = str(Path(path).resolve())
    return Path("\\\\?\\" + value) if os.name == "nt" and not value.startswith("\\\\?\\") else Path(value)


def digest(path):
    with native(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def tree_files(root, exclude=()):
    base = native(root)
    files = {}
    for p in sorted(base.rglob("*")):
        rel = p.relative_to(base).as_posix()
        if p.is_symlink() or (hasattr(p, "is_junction") and p.is_junction()):
            raise ValueError("Links are not accepted in build inputs or outputs")
        if p.is_file() and rel not in exclude:
            files[rel] = digest(p)
    return files


def tree_digest(files):
    return hashlib.sha256(
        "".join(f"{value}  {name}\n" for name, value in sorted(files.items())).encode("utf-8")
    ).hexdigest()


def source_state():
    names = (
        subprocess.check_output(
            ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=ROOT
        )
        .decode("utf-8")
        .split("\0")
    )
    files = {name: digest(ROOT / name) for name in names if name and (ROOT / name).is_file()}
    return {
        "commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "dirty": bool(subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, text=True).strip()),
        "treeSha256": tree_digest(files),
    }


def inputs():
    return json.loads((ROOT / "scripts/build-inputs.json").read_text(encoding="utf-8"))


def verify_upstream(source):
    expected = inputs()["desktop"]
    files = tree_files(source)
    actual = tree_digest(files)
    if actual != expected["treeSha256"]:
        raise ValueError(
            "Desktop files differ from the pinned upstream archive; use scripts/fetch_upstream.py"
        )
    return {
        "version": expected["version"],
        "archiveSha256": expected["sha256"],
        "treeSha256": actual,
        "files": len(files),
    }
