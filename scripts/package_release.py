"""Package only a verified build, with stable ZIP metadata and a checksum file."""

import argparse, json, zipfile
from pathlib import Path
from build_support import ROOT, digest, native
from verify_build import verify

parser = argparse.ArgumentParser()
parser.add_argument("folder", type=Path)
parser.add_argument("--output", type=Path, default=ROOT / "dist/release")
args = parser.parse_args()
verify(args.folder, require_clean=True)
version = json.loads((ROOT / "package.json").read_text())["version"]
args.output.mkdir(parents=True, exist_ok=True)
archive = args.output / f"DSH-Private-{version}-windows-x64.zip"
if archive.exists():
    raise SystemExit("Refusing to replace an existing release package")
base = native(args.folder)
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as z:
    for p in sorted(base.rglob("*")):
        if not p.is_file():
            continue
        info = zipfile.ZipInfo(
            "DSH-Private/" + p.relative_to(base).as_posix(), date_time=(2020, 1, 1, 0, 0, 0)
        )
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        with p.open("rb") as source, z.open(info, "w", force_zip64=True) as target:
            import shutil

            shutil.copyfileobj(source, target)
(args.output / "SHA256SUMS.txt").write_text(f"{digest(archive)}  {archive.name}\n", encoding="utf-8")
print("Packaged verified portable app and SHA256SUMS.txt.")
