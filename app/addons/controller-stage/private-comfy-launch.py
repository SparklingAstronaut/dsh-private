"""Host-only launcher: authenticate every Comfy HTTP/WebSocket route before handlers."""

import sys
import json
import secrets
import runpy
from pathlib import Path

sys.dont_write_bytecode = True
config = json.loads(sys.stdin.buffer.readline(65536))
token = config.pop("token", None)
workspace = config.pop("workspace", None)
job_name = config.pop("jobName", None)
comfy_dir = config.pop("comfyDir", None)
python_paths = config.pop("pythonPaths", [])
if not isinstance(workspace, str) or not Path(workspace).is_absolute():
    raise ValueError("Private workspace required")
if not isinstance(comfy_dir, str) or not (
    Path(comfy_dir).is_absolute() and (Path(comfy_dir) / "main.py").is_file()
):
    raise ValueError("ComfyUI folder required")
if not isinstance(python_paths, list) or not all(
    isinstance(p, str) and Path(p).is_absolute() for p in python_paths
):
    raise ValueError("Absolute Python paths required")
if (
    config
    or not isinstance(token, str)
    or len(token) != 64
    or any(c not in "0123456789abcdef" for c in token)
):
    raise ValueError("Invalid private service credential")
comfy = Path(comfy_dir).resolve()
# A portable interpreter may list another ComfyUI checkout; this one and its extra paths come first.
sys.path[:] = [p for p in sys.path if not (Path(p) / "comfy" / "model_management.py").is_file()]
sys.path[:0] = [str(comfy), *python_paths]
# Third-party nodes print symbols a Chinese code page cannot encode; keep startup from failing.
for stream in (sys.stdout, sys.stderr):
    if stream is not None and hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="backslashreplace")
job_api = runpy.run_path(str(Path(__file__).with_name("windows-job.py")))
job_handle = job_api["attach_current"](job_name)
job_api["watch_parent_pipe"](job_handle)
from aiohttp import web

guard = runpy.run_path(str(Path(__file__).with_name("private-io-guard.py")))
guard["install_guard"](workspace)


@web.middleware
async def authenticate(request, handler):
    # Browser origins are never trusted; host requests do not send Origin.
    supplied = request.headers.get("x-dsh-session", "")
    if request.headers.get("Origin") or not secrets.compare_digest(supplied.encode(), token.encode()):
        return web.Response(status=401, text="Unauthorized")
    return await handler(request)


original_init = web.Application.__init__


def secured_init(self, *args, **kwargs):
    kwargs["middlewares"] = [authenticate, *kwargs.get("middlewares", ())]
    original_init(self, *args, **kwargs)


web.Application.__init__ = secured_init
runpy.run_path(str(comfy / "main.py"), run_name="__main__")
