"""Paths for explicitly enabled local Python integrations."""

import json
import os
from pathlib import Path


def private_path(value):
    root = Path(os.environ["DSH_PRIVATE_APP_ROOT"])
    data = Path(os.environ["DSH_PRIVATE_DATA_ROOT"])
    settings = json.loads(os.environ.get("DSH_PRIVATE_SETTINGS", "{}"))
    if value == "node":
        return str(root / "runtime" / "node.exe")
    kind, _, rest = value.partition("/")
    base = {
        "app": root,
        "data": data,
        "private": data / "private",
        "image": Path(settings.get("imageRoot", data / "optional-image-runtime")),
    }.get(kind)
    if base is None:
        raise ValueError("Unknown private path namespace")
    result = (base / rest).resolve()
    result.relative_to(base.resolve())
    return str(result)
