"""Parse and rebuild a Windows VS_VERSIONINFO resource without executing anything.

The Electron executable inherited from DSH Desktop still describes itself as
"DSH Desktop Beta" (and Electron's default company name). These helpers keep
the resource layout and translations and only replace the product strings and
version numbers.
"""

import re
import struct

FIXED_SIGNATURE = 0xFEEF04BD


def _align(offset):
    return (offset + 3) & ~3


def _parse_block(data, offset):
    length, value_length, kind = struct.unpack_from("<HHH", data, offset)
    if length < 6 or offset + length > len(data):
        raise ValueError("Truncated version resource block")
    end = offset + length
    cursor = offset + 6
    terminator = cursor
    while data[terminator : terminator + 2] != b"\0\0":
        terminator += 2
        if terminator >= end:
            raise ValueError("Unterminated version resource key")
    key = data[cursor:terminator].decode("utf-16-le")
    cursor = _align(terminator + 2)
    size = value_length * 2 if kind == 1 else value_length
    value = data[cursor : cursor + size]
    cursor = _align(cursor + size)
    children = []
    while cursor < end:
        child, child_end = _parse_block(data, cursor)
        children.append(child)
        cursor = _align(child_end)
    return {"key": key, "type": kind, "value": value, "children": children}, end


def _build_block(block):
    key = block["key"].encode("utf-16-le") + b"\0\0"
    value = block["value"]
    head = 6 + len(key)
    body = bytearray(b"\0" * (_align(head) - head))
    body += value
    if not block["children"]:
        # Leaf blocks include their trailing alignment, as the resource compiler writes them.
        body += b"\0" * (_align(head + len(body)) - (head + len(body)))
    else:
        body += b"\0" * (_align(head + len(body)) - (head + len(body)))
        for index, child in enumerate(block["children"]):
            encoded = _build_block(child)
            body += encoded
            if index < len(block["children"]) - 1:
                body += b"\0" * (_align(head + len(body)) - (head + len(body)))
    value_length = len(value) // 2 if block["type"] == 1 else len(value)
    return struct.pack("<HHH", head + len(body), value_length, block["type"]) + key + bytes(body)


def parse(data):
    """Return the resource as a tree of {key, type, value, children} blocks."""
    root, end = _parse_block(data, 0)
    if root["key"] != "VS_VERSION_INFO" or len(root["value"]) != 52:
        raise ValueError("Not a VS_VERSIONINFO resource")
    if struct.unpack_from("<I", root["value"])[0] != FIXED_SIGNATURE:
        raise ValueError("Missing VS_FIXEDFILEINFO signature")
    return root


def build(root):
    return _build_block(root)


def strings(root):
    """Flatten every StringTable into {table_key: {name: value}}."""
    result = {}
    for section in root["children"]:
        if section["key"] != "StringFileInfo":
            continue
        for table in section["children"]:
            result[table["key"]] = {
                entry["key"]: entry["value"].decode("utf-16-le").rstrip("\0") for entry in table["children"]
            }
    return result


def numeric_version(version):
    """Map 0.1.0-preview.3 to (0, 1, 0, 3) and 1.2.3 to (1, 2, 3, 0)."""
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z-]+\.(\d+))?(?:[-+].*)?", version)
    if not match:
        raise ValueError(f"Unsupported version string: {version!r}")
    parts = tuple(int(part or 0) for part in match.groups())
    if any(part > 0xFFFF for part in parts):
        raise ValueError("Version component exceeds 65535")
    return parts


def rebrand(data, product, version, company):
    """Return a copy of the resource that names this product and version."""
    root = parse(data)
    major, minor, patch, build_number = numeric_version(version)
    fixed = bytearray(root["value"])
    high, low = (major << 16) | minor, (patch << 16) | build_number
    struct.pack_into("<IIII", fixed, 8, high, low, high, low)
    root["value"] = bytes(fixed)
    replacements = {
        "CompanyName": company,
        "FileDescription": product,
        "FileVersion": version,
        "InternalName": product,
        "LegalCopyright": f"Copyright (c) 2026 {company}",
        "OriginalFilename": f"{product}.exe",
        "ProductName": product,
        "ProductVersion": version,
    }
    tables = [
        table
        for section in root["children"]
        if section["key"] == "StringFileInfo"
        for table in section["children"]
    ]
    if not tables:
        raise ValueError("Version resource has no string table")
    for table in tables:
        present = {entry["key"] for entry in table["children"]}
        for entry in table["children"]:
            if entry["key"] in replacements:
                entry["value"] = (replacements[entry["key"]] + "\0").encode("utf-16-le")
                entry["type"] = 1
        for name, value in replacements.items():
            if name not in present:
                table["children"].append(
                    {"key": name, "type": 1, "value": (value + "\0").encode("utf-16-le"), "children": []}
                )
    return build(root)
