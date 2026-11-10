"""Download and unpack the hash-pinned Desktop without running its installer."""

from pathlib import Path
import argparse
import shutil
import subprocess
import urllib.request
from build_support import ROOT, digest, inputs, verify_upstream


def fetch(destination=ROOT / ".cache/upstream-source"):
    destination = Path(destination).resolve()
    if destination.exists():
        verify_upstream(destination)
        return destination
    pin = inputs()["desktop"]
    archive = ROOT / ".cache/upstream-desktop.exe"
    archive.parent.mkdir(exist_ok=True)
    if not archive.exists():
        partial = archive.with_suffix(".download")
        with urllib.request.urlopen(pin["url"], timeout=120) as response, partial.open("wb") as output:
            shutil.copyfileobj(response, output)
        partial.replace(archive)
    if digest(archive) != pin["sha256"]:
        raise ValueError("Upstream archive checksum mismatch")
    # Windows bsdtar reads the embedded archive without executing the EXE.
    listing = subprocess.check_output(["tar", "-tf", str(archive)], text=True)
    for name in listing.splitlines():
        parts = name.replace("\\", "/").split("/")
        if name.startswith(("/", "\\")) or ".." in parts or ":" in name:
            raise ValueError("Unsafe upstream archive path")
    destination.mkdir(parents=True)
    subprocess.run(["tar", "-xf", str(archive), "-C", str(destination)], check=True, capture_output=True)
    verify_upstream(destination)
    return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / ".cache/upstream-source")
    args = parser.parse_args()
    fetch(args.output)
    print("Verified pinned upstream archive and extracted file tree.")
