"""Build a clean Windows portable distribution from an unpacked Desktop 2.0.14-beta.1."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import urllib.request
from build_support import inputs, verify_upstream, tree_files, source_state

ROOT = Path(__file__).resolve().parents[1]
NODE_VERSION = inputs()["node"]["version"]


def long_path(value):
    value = str(Path(value).resolve())
    return "\\\\?\\" + value if os.name == "nt" and not value.startswith("\\\\?\\") else value


def download(url, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=120) as response, target.open("wb") as output:
        shutil.copyfileobj(response, output)


def build(source, output):
    source, output = source.resolve(), output.resolve()
    if output.exists():
        raise SystemExit("Choose a new output directory; existing builds are never overwritten.")
    upstream = verify_upstream(source)
    package = source / "resources/app"
    metadata = json.loads((package / "package.json").read_text(encoding="utf-8"))
    if metadata["version"] != "2.0.14-beta.1":
        raise SystemExit("This preview requires Desktop 2.0.14-beta.1.")
    executables = [p for p in source.glob("*.exe") if not p.name.lower().startswith("uninstall")]
    if len(executables) != 1:
        raise SystemExit("Expected one desktop executable.")
    output.mkdir(parents=True)
    # Explicit application-only allowlist. Never copy profiles, home directories, or installer state.
    for p in source.iterdir():
        if p.is_file() and (
            p.suffix in {".dll", ".pak", ".bin", ".dat"}
            or p.name in {"LICENSE.electron.txt", "LICENSES.chromium.html", "vk_swiftshader_icd.json"}
        ):
            shutil.copy2(p, output / p.name)
    shutil.copy2(executables[0], output / "DSH Private.exe")
    shutil.copytree(source / "locales", output / "locales")
    target = output / "resources/app"
    target.mkdir(parents=True)
    for name in ["lib", "build", "node_modules"]:
        shutil.copytree(
            long_path(package / name),
            long_path(target / name),
            ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".env", ".env.local", "*.log"),
        )
    shutil.copy2(package / "cordis.patch.yml", target / "cordis.patch.yml")
    (target / "incognito-root.yml").write_text("[]\n", encoding="utf-8")
    metadata["main"] = "private-entry.mjs"
    metadata["productName"] = "DSH Private"
    (target / "package.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    for p in (ROOT / "desktop-overrides").glob("*.js"):
        shutil.copy2(p, target / "lib" / p.name)
        # Original maps for modified modules no longer represent the distributed source.
        (target / "lib" / (p.name + ".map")).unlink(missing_ok=True)
    shutil.copy2(ROOT / "app-entry.mjs", target / "private-entry.mjs")
    app = output / "resources/private/app"
    shutil.copytree(ROOT / "app", app, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "runtime"))
    cache = ROOT / ".cache"
    node = cache / f"node-v{NODE_VERSION}.exe"
    expected = inputs()["node"]["sha256"]
    if not node.exists():
        download(inputs()["node"]["url"], node)
    if hashlib.sha256(node.read_bytes()).hexdigest() != expected:
        raise SystemExit("Node executable checksum mismatch.")
    (app / "runtime").mkdir()
    shutil.copy2(node, app / "runtime/node.exe")
    node_license = cache / "NODE-LICENSE.txt"
    if not node_license.exists():
        download(f"https://raw.githubusercontent.com/nodejs/node/v{NODE_VERSION}/LICENSE", node_license)
    if hashlib.sha256(node_license.read_bytes()).hexdigest() != inputs()["node"]["licenseSha256"]:
        raise SystemExit("Node license checksum mismatch.")
    shutil.copy2(node_license, app / "runtime/LICENSE.txt")
    shutil.copy2(ROOT / "app/assets/app.png", target / "build/app-icon.png")
    # Electron picks the tray image for the display scale (100/125/150/200 %),
    # so every scale variant must carry the DSH Private logo.
    for size, name in [
        (16, "tray-icon-blue.png"),
        (20, "tray-icon-blue@1.25x.png"),
        (24, "tray-icon-blue@1.5x.png"),
        (32, "tray-icon-blue@2x.png"),
    ]:
        shutil.copy2(ROOT / f"app/assets/tray-{size}.png", target / "build" / name)
    shutil.copy2(ROOT / "app/assets/app.ico", target / "build/app-icon.ico")
    from pe_icon_resources import replace_icons, replace_version_info

    version = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
    replace_icons(output / "DSH Private.exe", ROOT / "app/assets/app.ico")
    replace_version_info(output / "DSH Private.exe", "DSH Private", version, "DSH Private contributors")
    for name in ["README.md", "README.zh-CN.md", "LICENSE", "NOTICE.md", "SECURITY.md"]:
        shutil.copy2(ROOT / name, output / name)
    shutil.copytree(ROOT / "licenses", output / "licenses")
    shutil.copytree(ROOT / "docs", output / "docs")
    manifest = {
        "product": "DSH Private",
        "version": version,
        "desktop": metadata["version"],
        "node": NODE_VERSION,
        "nodeSha256": expected,
        "upstream": upstream,
        "source": source_state(),
        "files": tree_files(output),
    }
    (output / "BUILD.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print("Built DSH Private portable distribution.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--desktop-source", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "dist/DSH-Private")
    args = parser.parse_args()
    if args.desktop_source is None:
        from fetch_upstream import fetch

        args.desktop_source = fetch()
    build(args.desktop_source, args.output)
