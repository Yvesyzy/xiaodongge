"""Read-only APK native-library checks; no extraction or dependencies.

Run: python codex_check_apk_elf.py --apk <signed.apk> --output <new.json>
Checks ELF LOAD alignment and GNU_RELRO end alignment on 64-bit Android ABIs.
Passing these static checks does not replace a 16 KB runtime device test.
Reference: https://developer.android.com/guide/practices/page-sizes
"""
import argparse
import hashlib
import json
import struct
import zipfile
from pathlib import Path


def inspect_library(archive, entry):
    with archive.open(entry) as stream:
        header = stream.read(64)
        assert header[:4] == b"\x7fELF", entry.filename
        assert header[4] in (1, 2) and header[5] in (1, 2), entry.filename
        is_64 = header[4] == 2
        endian = "<" if header[5] == 1 else ">"
        phoff = struct.unpack_from(endian + ("Q" if is_64 else "I"), header, 32 if is_64 else 28)[0]
        phsize, phcount = struct.unpack_from(endian + "HH", header, 54 if is_64 else 42)
        assert phcount > 0 and phsize >= (56 if is_64 else 32), entry.filename
        segments = []
        for index in range(phcount):
            stream.seek(phoff + index * phsize)
            program = stream.read(phsize)
            fields = struct.unpack_from(endian + ("IIQQQQQQ" if is_64 else "IIIIIIII"), program)
            kind = fields[0]
            if kind not in (1, 0x6474E552):
                continue
            offset, address, memory, alignment = (fields[2], fields[3], fields[6], fields[7]) if is_64 else (fields[1], fields[2], fields[5], fields[7])
            segments.append({"type": "LOAD" if kind == 1 else "GNU_RELRO", "offset": offset,
                             "virtualAddress": address, "memoryBytes": memory, "alignment": alignment})
    abi = entry.filename.split("/")[1]
    relevant = abi in ("arm64-v8a", "x86_64")
    loads = [item for item in segments if item["type"] == "LOAD"]
    assert loads, entry.filename
    load_ok = all(item["alignment"] >= 16384 and
                  item["offset"] % 16384 == item["virtualAddress"] % 16384 for item in loads)
    relro_ok = all((item["virtualAddress"] + item["memoryBytes"]) % 16384 == 0
                   for item in segments if item["type"] == "GNU_RELRO")
    return {"path": entry.filename, "abi": abi, "elfBits": 64 if is_64 else 32,
            "bytes": entry.file_size, "zipCompression": entry.compress_type,
            "requires64Bit16KBCheck": relevant, "load16KBAligned": load_ok,
            "relroEnd16KBAligned": relro_ok, "segments": segments,
            "passed": not relevant or (load_ok and relro_ok)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apk", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    options = parser.parse_args()
    assert options.apk.is_file(), options.apk
    assert not options.output.exists(), "Refusing to overwrite audit evidence"
    with zipfile.ZipFile(options.apk) as archive:
        libraries = [inspect_library(archive, entry) for entry in archive.infolist()
                     if entry.filename.startswith("lib/") and entry.filename.endswith(".so")]
    assert libraries, "APK contains no native libraries to inspect"
    assert any(item["abi"] == "arm64-v8a" for item in libraries), "arm64-v8a missing"
    failures = [item["path"] for item in libraries if not item["passed"]]
    with options.apk.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    report = {"apk": str(options.apk.resolve()), "sha256": digest,
              "libraryCount": len(libraries), "failed64BitLibraries": failures,
              "passed": not failures, "runtime16KBTested": False, "libraries": libraries}
    with options.output.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
    print(json.dumps({key: report[key] for key in ("libraryCount", "failed64BitLibraries", "passed", "runtime16KBTested")}))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
