"""Operating-system write protection for private tool processes on Windows.

drop_to_untrusted() lowers the current process to the Untrusted integrity level. Windows then
refuses its writes to files, folders and the registry, including writes made by native code
(ctypes, C extensions), because ordinary objects only accept writes from processes at their own
integrity level or above. Reading files and using the network keep working. A process cannot
raise its integrity level again, so this holds for everything the process runs afterwards.
"""

import ctypes
import os

SEM_FAILCRITICALERRORS = 0x0001
SEM_NOGPFAULTERRORBOX = 0x0002
TOKEN_QUERY = 0x0008
TOKEN_ADJUST_DEFAULT = 0x0080
TOKEN_INTEGRITY_LEVEL = 25
SE_GROUP_INTEGRITY = 0x20
UNTRUSTED_RID = 0x0000


def drop_to_untrusted():
    """Lower this process to the Untrusted integrity level and confirm it. Returns False off Windows."""
    if os.name != "nt":
        return False
    from ctypes import wintypes as wt

    advapi = ctypes.WinDLL("advapi32", use_last_error=True)
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.GetCurrentProcess.restype = wt.HANDLE
    kernel.CloseHandle.argtypes = [wt.HANDLE]
    advapi.OpenProcessToken.argtypes = [wt.HANDLE, wt.DWORD, ctypes.POINTER(wt.HANDLE)]
    advapi.AllocateAndInitializeSid.argtypes = (
        [ctypes.c_void_p, ctypes.c_ubyte] + [wt.DWORD] * 8 + [ctypes.POINTER(ctypes.c_void_p)]
    )
    advapi.FreeSid.argtypes = [ctypes.c_void_p]
    advapi.GetLengthSid.argtypes = [ctypes.c_void_p]
    advapi.SetTokenInformation.argtypes = [wt.HANDLE, ctypes.c_int, ctypes.c_void_p, wt.DWORD]
    advapi.GetTokenInformation.argtypes = [
        wt.HANDLE,
        ctypes.c_int,
        ctypes.c_void_p,
        wt.DWORD,
        ctypes.POINTER(wt.DWORD),
    ]
    advapi.GetSidSubAuthorityCount.argtypes = [ctypes.c_void_p]
    advapi.GetSidSubAuthorityCount.restype = ctypes.POINTER(ctypes.c_ubyte)
    advapi.GetSidSubAuthority.argtypes = [ctypes.c_void_p, wt.DWORD]
    advapi.GetSidSubAuthority.restype = ctypes.POINTER(wt.DWORD)

    class SidAndAttributes(ctypes.Structure):
        _fields_ = [("Sid", ctypes.c_void_p), ("Attributes", wt.DWORD)]

    def fail(step):
        raise RuntimeError(
            "Could not lower the tool process integrity level (%s, error %d)"
            % (step, ctypes.get_last_error())
        )

    token = wt.HANDLE()
    if not advapi.OpenProcessToken(
        kernel.GetCurrentProcess(), TOKEN_QUERY | TOKEN_ADJUST_DEFAULT, ctypes.byref(token)
    ):
        fail("OpenProcessToken")
    try:
        sid = ctypes.c_void_p()
        authority = (ctypes.c_ubyte * 6)(0, 0, 0, 0, 0, 16)  # SECURITY_MANDATORY_LABEL_AUTHORITY
        if not advapi.AllocateAndInitializeSid(
            authority, 1, UNTRUSTED_RID, 0, 0, 0, 0, 0, 0, 0, ctypes.byref(sid)
        ):
            fail("AllocateAndInitializeSid")
        try:
            label = SidAndAttributes(sid, SE_GROUP_INTEGRITY)
            size = ctypes.sizeof(label) + advapi.GetLengthSid(sid)
            if not advapi.SetTokenInformation(token, TOKEN_INTEGRITY_LEVEL, ctypes.byref(label), size):
                fail("SetTokenInformation")
        finally:
            advapi.FreeSid(sid)
        needed = wt.DWORD()
        buffer = ctypes.create_string_buffer(256)
        if not advapi.GetTokenInformation(
            token, TOKEN_INTEGRITY_LEVEL, buffer, len(buffer), ctypes.byref(needed)
        ):
            fail("GetTokenInformation")
        current = SidAndAttributes.from_buffer(buffer).Sid
        count = advapi.GetSidSubAuthorityCount(current)[0]
        if advapi.GetSidSubAuthority(current, count - 1)[0] != UNTRUSTED_RID:
            raise RuntimeError("The tool process integrity level did not change")
    finally:
        kernel.CloseHandle(token)
    return True


def no_crash_dumps():
    """Keep Windows from saving a crash dump (a copy of this process's memory) if it crashes.

    With SEM_NOGPFAULTERRORBOX, Windows Error Reporting is skipped for this process and the programs it
    starts, so a crash leaves no copy of private data in %LOCALAPPDATA%\\CrashDumps. Returns the new error
    mode, or None off Windows.
    """
    if os.name != "nt":
        return None
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.GetErrorMode.restype = ctypes.c_uint
    kernel.SetErrorMode.argtypes = [ctypes.c_uint]
    kernel.SetErrorMode(kernel.GetErrorMode() | SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX)
    mode = kernel.GetErrorMode()
    if not mode & SEM_NOGPFAULTERRORBOX:
        raise RuntimeError("Could not turn off crash dumps for the tool process")
    return mode
