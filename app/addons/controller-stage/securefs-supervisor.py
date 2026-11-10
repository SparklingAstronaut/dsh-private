"""Keep the encrypted mount tied to the owning host's pipe lifetime."""

import sys
import json
import subprocess
import runpy
from pathlib import Path

api = runpy.run_path(str(Path(__file__).with_name("windows-job.py")))
config = json.loads(sys.stdin.buffer.readline(16384))
handle = api["attach_current"](config["jobName"])
api["watch_parent_pipe"](handle)
child = subprocess.Popen(
    [config["exe"], *config["args"]],
    stdin=subprocess.PIPE,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
    creationflags=subprocess.CREATE_NO_WINDOW,
)
payload = bytearray((config.pop("password") + "\n").encode())
try:
    child.stdin.write(payload)
    child.stdin.close()
finally:
    payload[:] = b"\0" * len(payload)
sys.exit(child.wait())
