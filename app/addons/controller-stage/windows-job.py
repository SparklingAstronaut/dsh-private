"""Windows job ownership for private image worker descendants."""
import ctypes as c
from ctypes import wintypes as w
import time
import sys
import re
import threading
import os
import msvcrt

k = c.WinDLL('kernel32', use_last_error=True)
class Limits(c.Structure):
    _fields_ = [('processTime',c.c_longlong),('jobTime',c.c_longlong),('flags',w.DWORD),
        ('minWorking',c.c_size_t),('maxWorking',c.c_size_t),('activeLimit',w.DWORD),
        ('affinity',c.c_size_t),('priority',w.DWORD),('scheduling',w.DWORD)]
class Extended(c.Structure):
    _fields_ = [('basic',Limits),('io',c.c_ulonglong*6),('processMemory',c.c_size_t),
        ('jobMemory',c.c_size_t),('peakProcess',c.c_size_t),('peakJob',c.c_size_t)]
class Accounting(c.Structure):
    _fields_ = [('times',c.c_longlong*4),('faults',w.DWORD),('total',w.DWORD),
        ('active',w.DWORD),('terminated',w.DWORD)]
for name,args,result in [
    ('CreateJobObjectW',[c.c_void_p,w.LPCWSTR],w.HANDLE),
    ('OpenJobObjectW',[w.DWORD,w.BOOL,w.LPCWSTR],w.HANDLE),
    ('SetInformationJobObject',[w.HANDLE,c.c_int,c.c_void_p,w.DWORD],w.BOOL),
    ('QueryInformationJobObject',[w.HANDLE,c.c_int,c.c_void_p,w.DWORD,c.c_void_p],w.BOOL),
    ('AssignProcessToJobObject',[w.HANDLE,w.HANDLE],w.BOOL),
    ('TerminateJobObject',[w.HANDLE,w.UINT],w.BOOL),
    ('GetCurrentProcess',[],w.HANDLE),('CloseHandle',[w.HANDLE],w.BOOL)]:
    fn=getattr(k,name);fn.argtypes=args;fn.restype=result

def checked(value):
    if not value: raise c.WinError(c.get_last_error())
    return value
def validate(name):
    if not isinstance(name,str) or not re.fullmatch(r'Local\\dsh-image-[a-f0-9-]{36}',name):
        raise ValueError('Invalid owned job name')
def attach_current(name):
    validate(name)
    handle=checked(k.CreateJobObjectW(None,name))
    if c.get_last_error()==183:
        k.CloseHandle(handle);raise RuntimeError('Job name already exists')
    limits=Extended();limits.basic.flags=0x2000 # KILL_ON_JOB_CLOSE; no breakaway
    try:
        checked(k.SetInformationJobObject(handle,9,c.byref(limits),c.sizeof(limits)))
        checked(k.AssignProcessToJobObject(handle,k.GetCurrentProcess()))
    except BaseException:
        k.CloseHandle(handle);raise
    return handle # Intentionally held for the complete worker lifetime.
def stop_and_wait(name):
    validate(name)
    handle=k.OpenJobObjectW(0x0008|0x0004,False,name) # terminate + query
    if not handle:
        if c.get_last_error()==2: return
        raise c.WinError(c.get_last_error())
    try:
        checked(k.TerminateJobObject(handle,1))
        deadline=time.monotonic()+20
        while True:
            info=Accounting()
            checked(k.QueryInformationJobObject(handle,1,c.byref(info),c.sizeof(info),None))
            if info.active==0:return
            if time.monotonic()>deadline:raise TimeoutError('Job processes remain active')
            time.sleep(.05)
    finally:k.CloseHandle(handle)

def watch_parent_pipe(handle):
    # The trusted host keeps stdin open for this process's full lifetime.
    # Host crash/exit closes the pipe; no heartbeat timer or PID reuse test.
    def watch():
        peek=k.PeekNamedPipe
        peek.argtypes=[w.HANDLE,c.c_void_p,w.DWORD,c.c_void_p,c.c_void_p,c.c_void_p]
        peek.restype=w.BOOL
        pipe=msvcrt.get_osfhandle(sys.stdin.fileno())
        try:
            # A blocking CRT stdin read can deadlock NumPy DLL initialization.
            # Poll the OS pipe without holding Python/CRT stream locks.
            while peek(pipe,None,0,None,None,None):time.sleep(.1)
        finally:
            k.CloseHandle(handle) # KILL_ON_JOB_CLOSE includes self and descendants.
    threading.Thread(target=watch,daemon=True).start()

if __name__=='__main__':
    if len(sys.argv)!=3 or sys.argv[1]!='--stop':raise ValueError('Expected owned job stop')
    stop_and_wait(sys.argv[2])
