"""Runs in an isolated process; resource limits precede PDF parsing."""

import os
import sys


def limit_memory():
    if os.name == "nt":
        import ctypes
        from ctypes import wintypes

        class BasicLimits(ctypes.Structure):
            _fields_ = [
                ("a", ctypes.c_int64),
                ("b", ctypes.c_int64),
                ("flags", wintypes.DWORD),
                ("min", ctypes.c_size_t),
                ("max", ctypes.c_size_t),
                ("active", wintypes.DWORD),
                ("affinity", ctypes.c_size_t),
                ("priority", wintypes.DWORD),
                ("scheduling", wintypes.DWORD),
            ]

        class IoCounters(ctypes.Structure):
            _fields_ = [(str(i), ctypes.c_uint64) for i in range(6)]

        class ExtendedLimits(ctypes.Structure):
            _fields_ = [
                ("basic", BasicLimits),
                ("io", IoCounters),
                ("process_memory", ctypes.c_size_t),
                ("job_memory", ctypes.c_size_t),
                ("peak_process", ctypes.c_size_t),
                ("peak_job", ctypes.c_size_t),
            ]

        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.CreateJobObjectW.restype = wintypes.HANDLE
        kernel.SetInformationJobObject.argtypes = [
            wintypes.HANDLE,
            wintypes.DWORD,
            ctypes.c_void_p,
            wintypes.DWORD,
        ]
        kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
        kernel.GetCurrentProcess.restype = wintypes.HANDLE
        job = kernel.CreateJobObjectW(None, None)
        limits = ExtendedLimits()
        limits.basic.flags = 0x100
        limits.process_memory = 256 * 1024 * 1024
        if not job or not kernel.SetInformationJobObject(
            job, 9, ctypes.byref(limits), ctypes.sizeof(limits)
        ):
            raise RuntimeError("Cannot set parser limit")
        if not kernel.AssignProcessToJobObject(job, kernel.GetCurrentProcess()):
            raise RuntimeError("Cannot isolate parser")
    else:
        import resource

        resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_CPU, (5, 5))


def main():
    limit_memory()
    from pypdf import PdfReader

    try:
        reader = PdfReader(sys.argv[1], strict=True)
        if reader.is_encrypted:
            print("encrypted_document")
        elif len(reader.pages) == 0:
            print("invalid_document")
        elif len(reader.pages) > 20:
            print("document_limit_exceeded")
        else:
            print("ok")
    except Exception:
        print("invalid_document")


if __name__ == "__main__":
    main()
