"""Read PE resources without executing the image; replace only icon resources."""

import ctypes
from ctypes import wintypes as w
import hashlib, struct
from pathlib import Path

k = ctypes.WinDLL("kernel32", use_last_error=True)
ptr = ctypes.c_void_p
TypeCallback = ctypes.WINFUNCTYPE(w.BOOL, w.HMODULE, ptr, ctypes.c_ssize_t)
NameCallback = ctypes.WINFUNCTYPE(w.BOOL, w.HMODULE, ptr, ptr, ctypes.c_ssize_t)
LangCallback = ctypes.WINFUNCTYPE(w.BOOL, w.HMODULE, ptr, ptr, w.WORD, ctypes.c_ssize_t)
for name, args, result in [
    ("LoadLibraryExW", [w.LPCWSTR, w.HANDLE, w.DWORD], w.HMODULE),
    ("FreeLibrary", [w.HMODULE], w.BOOL),
    ("EnumResourceTypesW", [w.HMODULE, TypeCallback, ctypes.c_ssize_t], w.BOOL),
    ("EnumResourceNamesW", [w.HMODULE, ptr, NameCallback, ctypes.c_ssize_t], w.BOOL),
    ("EnumResourceLanguagesW", [w.HMODULE, ptr, ptr, LangCallback, ctypes.c_ssize_t], w.BOOL),
    ("FindResourceExW", [w.HMODULE, ptr, ptr, w.WORD], w.HRSRC),
    ("SizeofResource", [w.HMODULE, w.HRSRC], w.DWORD),
    ("LoadResource", [w.HMODULE, w.HRSRC], w.HGLOBAL),
    ("LockResource", [w.HGLOBAL], ptr),
    ("BeginUpdateResourceW", [w.LPCWSTR, w.BOOL], w.HANDLE),
    ("UpdateResourceW", [w.HANDLE, ptr, ptr, w.WORD, ptr, w.DWORD], w.BOOL),
    ("EndUpdateResourceW", [w.HANDLE, w.BOOL], w.BOOL),
]:
    fn = getattr(k, name)
    fn.argtypes = args
    fn.restype = result


def checked(value):
    if not value:
        raise ctypes.WinError(ctypes.get_last_error())
    return value


def identifier(value):
    return value if value <= 65535 else ctypes.wstring_at(value)


def resource_pointer(value):
    return ptr(value) if isinstance(value, int) else ctypes.cast(ctypes.c_wchar_p(value), ptr)


def read_resources(file):
    module = checked(k.LoadLibraryExW(str(Path(file).resolve()), None, 0x22))
    result = {}
    errors = []

    @LangCallback
    def language(h, kind, name, lang, _):
        try:
            entry = checked(k.FindResourceExW(h, kind, name, lang))
            length = k.SizeofResource(h, entry)
            data = checked(k.LockResource(checked(k.LoadResource(h, entry))))
            result[(identifier(kind), identifier(name), lang)] = ctypes.string_at(data, length)
            return True
        except Exception as error:
            errors.append(error)
            return False

    @NameCallback
    def named(h, kind, name, _):
        try:
            return bool(checked(k.EnumResourceLanguagesW(h, kind, name, language, 0)))
        except Exception as error:
            errors.append(error)
            return False

    @TypeCallback
    def typed(h, kind, _):
        try:
            return bool(checked(k.EnumResourceNamesW(h, kind, named, 0)))
        except Exception as error:
            errors.append(error)
            return False

    try:
        ok = k.EnumResourceTypesW(module, typed, 0)
        if errors:
            raise errors[0]
        checked(ok)
        return result
    finally:
        k.FreeLibrary(module)


def ico_frames(data):
    reserved, kind, count = struct.unpack_from("<HHH", data)
    assert reserved == 0 and kind == 1 and count > 0
    frames = []
    for i in range(count):
        width, height, colors, reserved, planes, bpp, length, offset = struct.unpack_from(
            "<BBBBHHII", data, 6 + 16 * i
        )
        raw = data[offset : offset + length]
        assert len(raw) == length and offset >= 6 + 16 * count
        frames.append((width, height, colors, reserved, planes, bpp, raw))
    return frames


def extract_icon(resources, group):
    _, name, lang = group
    header = resources[group]
    reserved, kind, count = struct.unpack_from("<HHH", header)
    assert reserved == 0 and kind == 1
    directory = []
    images = []
    offset = 6 + 16 * count
    for i in range(count):
        width, height, colors, reserved, planes, bpp, length, rid = struct.unpack_from(
            "<BBBBHHIH", header, 6 + 14 * i
        )
        raw = resources[(3, rid, lang)]
        assert len(raw) == length
        directory.append(
            struct.pack("<BBBBHHII", width, height, colors, reserved, planes, bpp, length, offset)
        )
        images.append(raw)
        offset += length
    return struct.pack("<HHH", 0, 1, count) + b"".join(directory) + b"".join(images)


def pe_code_snapshot(file):
    data = Path(file).read_bytes()
    pe = struct.unpack_from("<I", data, 0x3C)[0]
    assert data[:2] == b"MZ" and data[pe : pe + 4] == b"PE\0\0"
    machine, count = struct.unpack_from("<HH", data, pe + 4)
    optional = pe + 24
    optional_size = struct.unpack_from("<H", data, pe + 20)[0]
    magic = struct.unpack_from("<H", data, optional)[0]
    assert magic in (0x10B, 0x20B)
    directory_start = optional + (112 if magic == 0x20B else 96)
    relocation_rva, relocation_size = struct.unpack_from("<II", data, directory_start + 5 * 8)
    image_base = struct.unpack_from(
        "<Q" if magic == 0x20B else "<I", data, optional + (24 if magic == 0x20B else 28)
    )[0]
    sections = {}
    end = 0
    for i in range(count):
        offset = optional + optional_size + 40 * i
        name = data[offset : offset + 8].rstrip(b"\0").decode("ascii")
        virtual_size, rva, size, raw = struct.unpack_from("<IIII", data, offset + 8)
        end = max(end, raw + size)
        if name != ".rsrc":
            # Resource resizing may relocate this table; validate its PE directory.
            if name == ".reloc":
                assert (relocation_rva, relocation_size) == (rva, virtual_size)
            sections[name] = {
                "rva": rva if name != ".reloc" else "validated-by-relocation-directory",
                "virtualSize": virtual_size,
                "rawSize": size,
                "characteristics": struct.unpack_from("<I", data, offset + 36)[0],
                "sha256": hashlib.sha256(data[raw : raw + size]).hexdigest(),
            }
    return {
        "machine": machine,
        "entryPoint": struct.unpack_from("<I", data, optional + 16)[0],
        "imageBase": image_base,
        "sections": sections,
        "overlaySha256": hashlib.sha256(data[end:]).hexdigest(),
    }


def replace_icons(staged_file, icon_file):
    before = read_resources(staged_file)
    code = pe_code_snapshot(staged_file)
    groups = [key for key in before if key[0] == 14]
    assert groups, "No existing application icon group"
    ico = Path(icon_file).read_bytes()
    frames = ico_frames(ico)
    update = checked(k.BeginUpdateResourceW(str(Path(staged_file).resolve()), False))
    committed = False

    def put(key, data):
        kind, name, lang = key
        buffer = ctypes.create_string_buffer(data) if data is not None else None
        checked(
            k.UpdateResourceW(
                update,
                resource_pointer(kind),
                resource_pointer(name),
                lang,
                ctypes.cast(buffer, ptr) if buffer is not None else None,
                len(data) if data is not None else 0,
            )
        )

    try:
        for key in before:
            if key[0] in (3, 14):
                put(key, None)
        group_data = struct.pack("<HHH", 0, 1, len(frames))
        for rid, (*fields, raw) in enumerate(frames, 1):
            group_data += struct.pack("<BBBBHHIH", *fields, len(raw), rid)
            for lang in {key[2] for key in groups}:
                put((3, rid, lang), raw)
        for key in groups:
            put(key, group_data)
        checked(k.EndUpdateResourceW(update, False))
        committed = True
    finally:
        if not committed:
            k.EndUpdateResourceW(update, True)
    after = read_resources(staged_file)
    assert {key: value for key, value in before.items() if key[0] not in (3, 14)} == {
        key: value for key, value in after.items() if key[0] not in (3, 14)
    }, "Non-icon resources changed"
    assert pe_code_snapshot(staged_file) == code, "Code or non-resource PE sections changed"
    for key in groups:
        assert extract_icon(after, key) == ico, "Embedded icon differs from selected ICO"
    assert len([key for key in after if key[0] == 3]) == len(frames) * len({key[2] for key in groups})
    return {
        "iconGroups": len(groups),
        "sizes": [[frame[0] or 256, frame[1] or 256] for frame in frames],
        "nonIconResourcesUnchanged": True,
        "nonResourceSectionContentsUnchanged": True,
        "relocationDirectoryValidated": True,
    }
