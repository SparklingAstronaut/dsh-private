"""Run one private MCP tool server.

"documents" is built in. Any other server is an adapter the user configured in settings.json under
mcp.adapters: a Python file that defines create_server(context) and returns a FastMCP server.

Before any adapter or third-party package runs, this process lowers itself to the Windows
Untrusted integrity level (process_guard.py), so Windows refuses its writes to files and the
registry, also from native code. Python file access then goes to an in-memory filesystem
(pyfakefs) whose new files come back to the chat. It also turns off Windows crash dumps for itself
and the programs it starts, so a crash leaves no copy of its memory on disk. This is not a full
sandbox: an adapter can still read files your Windows account can read and use the network, so only
add adapters you trust.
"""

from portable_paths import private_path
from process_guard import drop_to_untrusted, no_crash_dumps
import os, sys, json, base64, logging, hashlib, re, site, importlib.util
from pathlib import Path
from types import SimpleNamespace

MCP_SETTINGS = json.loads(os.environ.get("DSH_PRIVATE_SETTINGS", "{}")).get("mcp") or {}
SITE_PACKAGES = MCP_SETTINGS.get("sitePackages") or ""
OWNER = os.environ.get("PRIVATE_OWNER")
if OWNER not in ("model-a", "model-b"):
    raise RuntimeError("Private model required")
SERVER = sys.argv[1]
ADAPTER_FILE = None
ADAPTER_READ_ONLY = []
if SERVER != "documents":
    adapter = (MCP_SETTINGS.get("adapters") or {}).get(SERVER)
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,31}", SERVER) or not isinstance(adapter, dict):
        raise RuntimeError("Unknown private MCP server")
    ADAPTER_FILE = Path(str(adapter.get("file", "")))
    if not ADAPTER_FILE.is_absolute() or ADAPTER_FILE.suffix.lower() != ".py" or not ADAPTER_FILE.is_file():
        raise RuntimeError("Private tool adapter file is missing or invalid")
    ADAPTER_READ_ONLY = [str(Path(p)) for p in adapter.get("readOnly", []) if Path(str(p)).is_absolute()]
# A held process handle avoids PID-reuse races and clears in-memory data if the desktop crashes.
if os.name == "nt" and os.environ.get("PRIVATE_PARENT_PID"):
    import ctypes, threading

    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.OpenProcess.restype = ctypes.c_void_p
    kernel.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
    parent = kernel.OpenProcess(0x100000, False, int(os.environ["PRIVATE_PARENT_PID"]))
    if not parent:
        raise RuntimeError("Private parent is unavailable")

    def watch_parent():
        kernel.WaitForSingleObject(parent, 0xFFFFFFFF)
        os._exit(0)

    threading.Thread(target=watch_parent, daemon=True).start()
# The parent handle above is opened first; from here on, nothing this process runs can write.
no_crash_dumps()
drop_to_untrusted()
if SITE_PACKAGES:
    site.addsitedir(SITE_PACKAGES)
if SERVER == "documents":
    import pypdf, docx, openpyxl, io, zipfile, xml.etree.ElementTree
from pyfakefs.fake_filesystem_unittest import Patcher

real_roots = [sys.base_prefix, str(Path(sys.executable).parent.parent)]
if SITE_PACKAGES:
    real_roots.append(SITE_PACKAGES)
if ADAPTER_FILE:
    real_roots += [str(ADAPTER_FILE.parent), *ADAPTER_READ_ONLY]
patcher = Patcher()
patcher.setUp()
for root in sorted(set(real_roots), key=len):
    if not patcher.fs.exists(root):
        patcher.fs.add_real_directory(root, read_only=True)
ROOT = Path(private_path("private")) / OWNER
ROOT.mkdir(parents=True, exist_ok=True)
os.environ.update(
    PYTHONDONTWRITEBYTECODE="1",
    PRIVATE_OWNER=OWNER,
    XDG_CACHE_HOME=str(ROOT / "cache"),
    TEMP=str(ROOT / "tmp"),
    TMP=str(ROOT / "tmp"),
    CUDA_VISIBLE_DEVICES="-1",
)
(ROOT / "tmp").mkdir(exist_ok=True)
logging.disable(logging.CRITICAL)


def audit(event, args):
    if event == "open":
        _path, mode, flags = args
        if (isinstance(mode, str) and any(c in mode for c in "wa+")) or flags & (
            os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND
        ):
            raise PermissionError("Private MCP denied a real filesystem write")
    if event in (
        "os.remove",
        "os.rename",
        "os.mkdir",
        "os.rmdir",
        "os.link",
        "os.symlink",
        "os.chmod",
        "subprocess.Popen",
        "os.system",
    ):
        raise PermissionError("Private MCP denied a host mutation")
    if event == "sqlite3.connect" and args[0] != ":memory:":
        raise PermissionError("Private MCP requires an in-memory database")


sys.excepthook = lambda kind, value, tb: sys.stderr.write(kind.__name__ + ": " + str(value) + "\n")
sys.addaudithook(audit)
IMPORT_DIRECTORIES = {}
if SERVER == "documents":
    from mcp.server.fastmcp import FastMCP

    mcp = FastMCP("Private document reader")

    @mcp.tool()
    def read_document(input_file: str, offset: int = 0, limit: int = 100) -> dict:
        """Read PDF, DOCX, XLSX or PPTX content, including uploaded attachment paths. PDF sections are pages, Word sections are paragraphs/tables, spreadsheet sections are rows, and slide sections are slides. offset is zero-based; limit 1..200. Does not run macros or formulas. Scanned PDFs require image/OCR support and may contain no extractable text."""
        if offset < 0 or not 1 <= limit <= 200:
            raise ValueError("Invalid document range")
        p = Path(input_file).resolve()
        if not p.is_relative_to(ROOT.resolve()):
            raise ValueError("Use the private document input")
        raw = p.read_bytes()
        if len(raw) > 32 * 1024 * 1024:
            raise ValueError("Document exceeds 32 MB")
        source = io.BytesIO(raw)
        sections = []
        kind = ""
        if raw.startswith(b"%PDF-"):
            kind = "PDF"
            reader = pypdf.PdfReader(source)
            if reader.is_encrypted:
                raise ValueError("Password-protected PDF: provide an unlocked copy")
            total = len(reader.pages)
            for i in range(offset, min(total, offset + limit)):
                sections.append({"label": f"Page {i+1}", "text": reader.pages[i].extract_text() or ""})
        elif zipfile.is_zipfile(source):
            with zipfile.ZipFile(source) as z:
                entries = z.infolist()
                if len(entries) > 10000 or sum(e.file_size for e in entries) > 128 * 1024 * 1024:
                    raise ValueError("Office archive exceeds expanded-size limit")
                names = set(z.namelist())
                if "word/document.xml" in names:
                    kind = "DOCX"
                    document = docx.Document(io.BytesIO(raw))
                    items = []
                    for block in document.iter_inner_content():
                        if isinstance(block, docx.text.paragraph.Paragraph):
                            text = block.text
                        else:
                            text = "\n".join("\t".join(c.text for c in r.cells) for r in block.rows)
                        items.append({"label": f"Block {len(items)+1}", "text": text})
                elif "xl/workbook.xml" in names:
                    kind = "XLSX"
                    book = openpyxl.load_workbook(
                        io.BytesIO(raw), read_only=True, data_only=False, keep_links=False
                    )
                    items = []
                    try:
                        for sheet in book:
                            for i, row in enumerate(sheet.iter_rows(values_only=True), 1):
                                if len(items) >= 100000:
                                    raise ValueError("Workbook has too many rows")
                                items.append(
                                    {
                                        "label": f"{sheet.title}!{i}",
                                        "text": "\t".join("" if v is None else str(v) for v in row),
                                    }
                                )
                    finally:
                        book.close()
                elif "ppt/presentation.xml" in names:
                    import re

                    kind = "PPTX"
                    items = []

                    def parse_slide(data: bytes):
                        if b"<!DOCTYPE" in data[:4096] or b"<!ENTITY" in data[:4096]:
                            raise ValueError("Slide XML contains DTD entities")
                        return xml.etree.ElementTree.fromstring(data)

                    for name in sorted(
                        (n for n in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)),
                        key=lambda n: int(re.search(r"(\d+)\.xml", n).group(1)),
                    ):
                        element = parse_slide(z.read(name))
                        items.append(
                            {
                                "label": f"Slide {len(items)+1}",
                                "text": "\n".join(
                                    e.text or "" for e in element.iter() if e.tag.endswith("}t")
                                ),
                            }
                        )
                else:
                    raise ValueError("Unsupported Office archive")
                total = len(items)
                sections = items[offset : offset + limit]
        else:
            raise ValueError("Supported documents: PDF, DOCX, XLSX, PPTX")
        remaining = 100000
        trimmed = []
        truncated = False
        for section in sections:
            text = section["text"]
            part = text[:remaining]
            trimmed.append({**section, "text": part})
            remaining -= len(part)
            if len(part) < len(text):
                truncated = True
            if remaining == 0:
                truncated = True
                break
        return {
            "format": kind,
            "total_sections": total,
            "offset": offset,
            "sections": trimmed,
            "truncated": truncated,
            "next_offset": offset + len(trimmed) if offset + len(trimmed) < total else None,
            "note": "Text extraction only; no OCR, macros or formula recalculation.",
        }

else:
    # The adapter's own folder is importable, as a read-only real directory inside the sandbox.
    sys.path.insert(0, str(ADAPTER_FILE.parent))
    spec = importlib.util.spec_from_file_location("private_tool_adapter", ADAPTER_FILE)
    adapter_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(adapter_module)
    mcp = adapter_module.create_server(SimpleNamespace(root=ROOT, owner=OWNER, private_path=private_path))
    # Optional {tool name: argument name}: the host copies that host folder in as read-only input.
    declared = getattr(adapter_module, "IMPORT_DIRECTORIES", {}) or {}
    if not isinstance(declared, dict) or not all(
        isinstance(k, str) and isinstance(v, str) and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,63}", v)
        for k, v in declared.items()
    ):
        raise RuntimeError("Private tool adapter IMPORT_DIRECTORIES is invalid")
    IMPORT_DIRECTORIES = dict(declared)


@mcp.tool()
def _private_manifest() -> dict:
    """Host-only: tool arguments that name a host folder to import as input."""
    return {"importDirectories": IMPORT_DIRECTORIES}


@mcp.tool()
def _private_restore(files: list[dict]) -> dict:
    """Host-only: restore encrypted chat files into the process-local filesystem."""
    total = 0
    for f in files:
        p = Path(f["path"])
        if not p.resolve().is_relative_to(ROOT.resolve()):
            raise ValueError("Private path outside owner root")
        if f.get("deleted"):
            p.unlink(missing_ok=True)
            continue
        data = base64.b64decode(f["data"], validate=True)
        total += len(data)
        if total > 128 * 1024 * 1024:
            raise ValueError("Private MCP file budget exceeded")
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
    return {"restored": len(files)}


@mcp.tool()
def _private_snapshot(known: dict[str, str] = {}) -> dict:
    """Host-only: transfer new or changed artifacts in bounded rounds to the owning chat."""
    files = []
    total = 0
    more = False
    budget = 16 * 1024 * 1024
    for p in ROOT.rglob("*"):
        if not p.is_file() or "cache" in p.relative_to(ROOT).parts or "tmp" in p.relative_to(ROOT).parts:
            continue
        data = p.read_bytes()
        if len(data) > 256 * 1024 * 1024:
            raise ValueError("Single private artifact exceeds transfer limit")
        digest = hashlib.sha256(data).hexdigest()
        key = str(p)
        if known.get(key.lower()) == digest or known.get(key.replace("\\", "/").lower()) == digest:
            continue
        if files and total + len(data) > budget:
            more = True
            break
        total += len(data)
        files.append({"path": key, "data": base64.b64encode(data).decode("ascii")})
    return {"files": files, "more": more}


if __name__ == "__main__":
    mcp.run(transport="stdio")
