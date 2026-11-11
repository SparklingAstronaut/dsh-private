import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

APP_PYTHON = pathlib.Path(__file__).resolve().parents[1] / "app" / "python"

# Runs in a child process: lowering the integrity level cannot be undone.
PROBE = r"""
import ctypes, sys
sys.path.insert(0, sys.argv[1])
from process_guard import drop_to_untrusted
assert drop_to_untrusted()
kernel = ctypes.WinDLL("kernel32", use_last_error=True)
kernel.CreateFileW.argtypes = [ctypes.c_wchar_p, ctypes.c_uint32, ctypes.c_uint32, ctypes.c_void_p, ctypes.c_uint32, ctypes.c_uint32, ctypes.c_void_p]
kernel.CreateFileW.restype = ctypes.c_void_p
handle = kernel.CreateFileW(sys.argv[2], 0x40000000, 0, None, 2, 0x80, None)
print("native-write", "refused" if handle in (None, ctypes.c_void_p(-1).value) else "allowed", ctypes.get_last_error())
try:
    with open(sys.argv[2] + ".py-write", "w") as f:
        f.write("SYNTHETIC")
    print("python-write allowed")
except PermissionError:
    print("python-write refused")
with open(sys.argv[3]) as f:
    print("read", f.read())
"""


# Runs in a child process: the error mode is per process and inherited by the programs it starts.
CRASH_DUMP_PROBE = r"""
import ctypes, subprocess, sys
sys.path.insert(0, sys.argv[1])
from process_guard import no_crash_dumps
print("before", ctypes.windll.kernel32.GetErrorMode())
print("after", no_crash_dumps())
child = subprocess.run([sys.executable, "-I", "-c", "import ctypes; print(ctypes.windll.kernel32.GetErrorMode())"], capture_output=True, text=True)
print("child", child.stdout.strip())
"""


@unittest.skipUnless(os.name == "nt", "Windows integrity levels")
class ProcessGuardTest(unittest.TestCase):
    def test_tool_process_and_its_programs_save_no_crash_dumps(self):
        run = subprocess.run(
            [sys.executable, "-I", "-B", "-c", CRASH_DUMP_PROBE, str(APP_PYTHON)],
            capture_output=True,
            text=True,
            timeout=60,
        )
        self.assertEqual(run.returncode, 0, run.stderr)
        values = dict(line.split() for line in run.stdout.splitlines())
        # SEM_NOGPFAULTERRORBOX (2): Windows Error Reporting, and with it the crash dump, is skipped.
        self.assertTrue(int(values["after"]) & 2, run.stdout)
        self.assertTrue(int(values["child"]) & 2, run.stdout)

    def test_tool_process_cannot_write_after_dropping_to_untrusted(self):
        with tempfile.TemporaryDirectory() as folder:
            folder = pathlib.Path(folder)
            target = folder / "native-write.txt"
            readable = folder / "readable.txt"
            readable.write_text("SYNTHETIC_READ", encoding="utf-8")
            run = subprocess.run(
                [sys.executable, "-I", "-B", "-c", PROBE, str(APP_PYTHON), str(target), str(readable)],
                capture_output=True,
                text=True,
                timeout=60,
            )
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertIn("native-write refused 5", run.stdout)
            self.assertIn("python-write refused", run.stdout)
            self.assertIn("read SYNTHETIC_READ", run.stdout)
            self.assertFalse(target.exists())
            self.assertFalse(pathlib.Path(str(target) + ".py-write").exists())


if __name__ == "__main__":
    unittest.main()
