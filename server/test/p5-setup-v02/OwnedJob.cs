using System;
using System.Runtime.InteropServices;
public sealed class FwsP5OwnedJobV02 : IDisposable {
  [StructLayout(LayoutKind.Sequential)] struct Basic { public long ProcessTime,JobTime; public uint Flags; public UIntPtr Min,Max; public uint Processes; public UIntPtr Affinity; public uint Priority,Scheduling; }
  [StructLayout(LayoutKind.Sequential)] struct IO { public ulong ReadOps,WriteOps,OtherOps,ReadBytes,WriteBytes,OtherBytes; }
  [StructLayout(LayoutKind.Sequential)] struct Limits { public Basic Basic; public IO IO; public UIntPtr ProcessMemory,JobMemory,PeakProcess,PeakJob; }
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attrs,string name);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,IntPtr info,uint length);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  IntPtr handle;
  public FwsP5OwnedJobV02() {
    handle=CreateJobObject(IntPtr.Zero,null); if(handle==IntPtr.Zero) throw new InvalidOperationException("OWNED_JOB_CREATE_FAILED");
    var limits=new Limits(); limits.Basic.Flags=0x2000;
    int length=Marshal.SizeOf(typeof(Limits)); IntPtr data=Marshal.AllocHGlobal(length);
    try { Marshal.StructureToPtr(limits,data,false); if(!SetInformationJobObject(handle,9,data,(uint)length)) { Dispose(); throw new InvalidOperationException("OWNED_JOB_LIMIT_FAILED"); } }
    finally { Marshal.FreeHGlobal(data); }
  }
  public void Attach(IntPtr process) { if(!AssignProcessToJobObject(handle,process)) throw new InvalidOperationException("OWNED_JOB_ATTACH_FAILED"); }
  public void Dispose() { if(handle!=IntPtr.Zero){ CloseHandle(handle);handle=IntPtr.Zero; } }
}
