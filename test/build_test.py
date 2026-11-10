"""Prove provenance checks reject changed bytes, missing files and unsafe inputs."""

from pathlib import Path
import json
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build_support import tree_files, tree_digest, verify_upstream
from verify_build import verify
from scan_release import scan


class BuildTests(unittest.TestCase):
    def test_upstream_check_rejects_modified_file_even_with_same_version(self):
        with tempfile.TemporaryDirectory(prefix="dsh-build-test-") as temporary:
            root = Path(temporary)
            (root / "package.json").write_text('{"version":"2.0.14-beta.1"}')
            binary = root / "library.dll"
            binary.write_bytes(b"SYNTHETIC_ORIGINAL")
            pin = {
                "desktop": {
                    "version": "2.0.14-beta.1",
                    "sha256": "synthetic",
                    "treeSha256": tree_digest(tree_files(root)),
                }
            }
            with patch("build_support.inputs", return_value=pin):
                verify_upstream(root)
                binary.write_bytes(b"SYNTHETIC_MODIFIED")
                with self.assertRaises(ValueError):
                    verify_upstream(root)

    def test_manifest_rejects_changes_missing_files_and_dirty_release_source(self):
        with tempfile.TemporaryDirectory(prefix="dsh-build-test-") as temporary:
            root = Path(temporary)
            binary = root / "library.dll"
            binary.write_bytes(b"SYNTHETIC_ORIGINAL")
            state = {"commit": "synthetic", "dirty": False, "treeSha256": "synthetic"}
            manifest = {"source": state, "files": tree_files(root)}
            (root / "BUILD.json").write_text(json.dumps(manifest))
            with patch("verify_build.source_state", return_value=state):
                binary.write_bytes(b"SYNTHETIC_MODIFIED")
                with self.assertRaisesRegex(ValueError, "Portable files"):
                    verify(root)
                binary.unlink()
                with self.assertRaisesRegex(ValueError, "Portable files"):
                    verify(root)
            with patch("verify_build.source_state", return_value={**state, "dirty": True}):
                with self.assertRaisesRegex(ValueError, "clean source"):
                    verify(root, True)

    def test_scan_flags_env_style_secrets_and_virtualenvs(self):
        with tempfile.TemporaryDirectory(prefix="dsh-build-test-") as temporary:
            root = Path(temporary)
            (root / "app").mkdir()
            (root / "app" / "notes.txt").write_text("SYNTHETIC")
            self.assertEqual(scan(root, [])[1], [])
            (root / "app" / "pixiv.env").write_text("SYNTHETIC_TOKEN=1")
            (root / "app" / ".env.production").write_text("SYNTHETIC=1")
            (root / "app" / "venv").mkdir()
            (root / "app" / "venv" / "pyvenv.cfg").write_text("home = synthetic")
            labels = sorted(label for _, label in scan(root, [])[1])
            self.assertEqual(labels, ["data/cache file", "data/cache file", "virtual environment file"])


if __name__ == "__main__":
    unittest.main()
