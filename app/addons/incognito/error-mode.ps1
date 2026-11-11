param([Parameter(Mandatory = $true)][int]$TargetPid, [switch]$Set)
# Reads, and with -Set adds SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX to, the Windows error mode
# of a DSH Private process. With SEM_NOGPFAULTERRORBOX a crash ends the process without Windows Error
# Reporting, so Windows saves no crash dump (a copy of the program's memory). Programs the process
# starts afterwards inherit the mode. Prints the mode before and after, e.g. "0x8000 0x8003".
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class DshPrivateErrorMode {
  [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr h, int cls, out uint value, int len, IntPtr ret);
  [DllImport("ntdll.dll")] static extern int NtSetInformationProcess(IntPtr h, int cls, ref uint value, int len);
  [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  const int ProcessDefaultHardErrorMode = 12;
  public static string Apply(int pid, bool set) {
    // PROCESS_QUERY_INFORMATION, plus PROCESS_SET_INFORMATION to change it.
    IntPtr h = OpenProcess(set ? 0x0600u : 0x0400u, false, pid);
    if (h == IntPtr.Zero) throw new Exception("OpenProcess failed " + Marshal.GetLastWin32Error());
    try {
      uint before;
      int status = NtQueryInformationProcess(h, ProcessDefaultHardErrorMode, out before, 4, IntPtr.Zero);
      if (status != 0) throw new Exception("query failed 0x" + status.ToString("X"));
      uint after = before;
      if (set) {
        after = before | 0x3;
        status = NtSetInformationProcess(h, ProcessDefaultHardErrorMode, ref after, 4);
        if (status != 0) throw new Exception("set failed 0x" + status.ToString("X"));
        NtQueryInformationProcess(h, ProcessDefaultHardErrorMode, out after, 4, IntPtr.Zero);
      }
      return "0x" + before.ToString("X") + " 0x" + after.ToString("X");
    } finally {
      CloseHandle(h);
    }
  }
}
"@
[DshPrivateErrorMode]::Apply($TargetPid, $Set.IsPresent)
