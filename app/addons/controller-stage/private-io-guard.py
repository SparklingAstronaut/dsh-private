"""Defense in depth for Python-managed file mutations, not an OS sandbox."""

import os
import sys


def install_guard(workspace):
    root = os.path.normcase(os.path.realpath(workspace))

    def confined(value):
        if isinstance(value, int):
            raise PermissionError("Unverified file descriptor mutation")
        target = os.path.normcase(os.path.realpath(os.fsdecode(value)))
        try:
            valid = os.path.commonpath([root, target]) == root
        except ValueError:
            valid = False
        if not valid:
            raise PermissionError("Private file mutation outside encrypted workspace")

    def audit(event, args):
        if event == "open":
            mode, flags = args[1], args[2] or 0
            if (isinstance(mode, str) and any(c in mode for c in "wax+")) or flags & (
                os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND
            ):
                confined(args[0])
        elif event in ("os.remove", "os.rmdir", "os.mkdir", "os.chmod", "os.utime", "os.truncate"):
            confined(args[0])
        elif event == "os.rename":
            confined(args[0])
            confined(args[1])
        elif event in ("os.link", "os.symlink"):
            raise PermissionError("Private workspace links are forbidden")
        elif event == "sqlite3.connect" and args[0] != ":memory:":
            confined(args[0])

    sys.addaudithook(audit)
