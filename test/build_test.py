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
import pe_version_info


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

    def test_version_info_round_trips_and_renames_only_product_fields(self):
        def text(key, value):
            return {"key": key, "type": 1, "value": (value + "\0").encode("utf-16-le"), "children": []}

        fixed = bytearray(52)
        fixed[:4] = (0xFEEF04BD).to_bytes(4, "little")
        table = {
            "key": "040904b0",
            "type": 1,
            "value": b"",
            "children": [text("ProductName", "Upstream Beta"), text("SquirrelAwareVersion", "1")],
        }
        translation = {"key": "Translation", "type": 0, "value": bytes.fromhex("0904b004"), "children": []}
        root = {
            "key": "VS_VERSION_INFO",
            "type": 0,
            "value": bytes(fixed),
            "children": [
                {"key": "StringFileInfo", "type": 1, "value": b"", "children": [table]},
                {"key": "VarFileInfo", "type": 1, "value": b"", "children": [translation]},
            ],
        }
        original = pe_version_info.build(root)
        self.assertEqual(pe_version_info.build(pe_version_info.parse(original)), original)
        renamed = pe_version_info.parse(
            pe_version_info.rebrand(original, "DSH Private", "0.1.0-preview.3", "DSH Private contributors")
        )
        values = pe_version_info.strings(renamed)["040904b0"]
        self.assertEqual(values["ProductName"], "DSH Private")
        self.assertEqual(values["FileVersion"], "0.1.0-preview.3")
        self.assertEqual(values["SquirrelAwareVersion"], "1")
        self.assertEqual(int.from_bytes(renamed["value"][8:12], "little"), 1)
        self.assertEqual(int.from_bytes(renamed["value"][12:16], "little"), 3)
        self.assertEqual(renamed["children"][1]["children"][0]["value"], bytes.fromhex("0904b004"))
        self.assertEqual(pe_version_info.numeric_version("1.2.3"), (1, 2, 3, 0))
        with self.assertRaises(ValueError):
            pe_version_info.numeric_version("latest")


if __name__ == "__main__":
    unittest.main()
