"""Verify an already running OCR worker: python tests/docker/verify_isolation.py CONTAINER."""

import json
import subprocess
import sys


def docker(*args):
    return subprocess.run(["docker", *args], check=True, capture_output=True, text=True).stdout


def main(container):
    info = json.loads(docker("inspect", container))[0]
    host = info["HostConfig"]
    assert info["Config"]["User"] == "10001:10001"
    assert host["NetworkMode"] == "none"
    assert host["ReadonlyRootfs"] is True
    assert "ALL" in host["CapDrop"]
    assert "no-new-privileges:true" in host["SecurityOpt"]
    assert host["Memory"] == 512 * 1024 * 1024
    assert host["NanoCpus"] == 1_000_000_000
    assert host["PidsLimit"] == 32
    assert not any("DATABASE_URL=" in entry for entry in info["Config"]["Env"])
    assert all(mount["Destination"] == "/spool" for mount in info["Mounts"])

    probe = r"""
import os, socket
from pathlib import Path
assert os.getuid() == 10001 and os.getgid() == 10001
assert not any(key in os.environ for key in ("DATABASE_URL", "POSTGRES_PASSWORD"))
assert not Path("/var/lib/invoiceflow/documents").exists()
trusted = [Path("/app/ocr_worker.py")]
traineddata = Path("/usr/share/tesseract-ocr/5/tessdata")
trusted.extend(traineddata / f"{lang}.traineddata" for lang in ("eng", "pol"))
for path in trusted:
    assert path.is_file()
    try:
        with path.open("ab"):
            pass
    except OSError:
        pass
    else:
        raise AssertionError(f"Writable trusted file: {path}")
assert set(name for _, name in socket.if_nameindex()) == {"lo"}
try:
    socket.create_connection(("1.1.1.1", 53), timeout=2)
except OSError:
    pass
else:
    raise AssertionError("Worker has external network access")
"""
    docker("exec", container, "python", "-c", probe)
    version = docker("exec", container, "tesseract", "--version")
    assert version.splitlines()[0] == "tesseract 5.5.4", version
    languages = docker("exec", container, "tesseract", "--list-langs")
    assert {"eng", "pol"}.issubset(set(languages.splitlines()))
    print("OCR worker isolation checks passed")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Pass the ID of an already running OCR worker container")
    main(sys.argv[1])
