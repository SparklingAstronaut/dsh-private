from portable_paths import private_path
"""Local MCP adapter for gallery-dl and waifuc. Long jobs run in isolated workers."""
import json, os, re, subprocess, sys, uuid
from pathlib import Path
from urllib.parse import urlparse
BASE = Path(__file__).resolve().parent
OWNER = os.environ.get('PRIVATE_ART_OWNER')
if OWNER not in {'Heretic','QQZ'}: raise RuntimeError('Launch through the Heretic/QQZ private MCP connector')
DATA = Path(private_path("private")) / OWNER
JOBS = DATA / 'jobs'
PRIVATE_MEMORY = False
os.environ['HF_HOME'] = private_path("private/cache/huggingface")
os.environ['XDG_CACHE_HOME'] = private_path("private/cache")
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
os.environ['PYTHONUTF8'] = '1'
for folder in (DATA, JOBS): folder.mkdir(parents=True, exist_ok=True)

def save(p, value):
    tmp = p.with_suffix('.tmp'); tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8'); tmp.replace(p)

def local_folder(value):
    p = Path(value).resolve()
    if not p.is_relative_to(DATA.resolve()) or not p.is_dir():
        raise ValueError('Input must be an existing folder inside '+str(DATA))
    return p

def launch(kind, args):
    jid = uuid.uuid4().hex
    spec = JOBS / (jid + '.json')
    output = DATA / ('downloads' if kind == 'gallery' else 'datasets') / jid
    save(spec, dict(id=jid, kind=kind, state='queued', args=args, output=str(output)))
    with (JOBS / (jid + '.log')).open('wb') as log:
        subprocess.Popen([sys.executable, str(Path(__file__).resolve()), '--worker', jid], stdout=log, stderr=log, cwd=BASE, creationflags=subprocess.CREATE_NO_WINDOW)
    return dict(job_id=jid, output=str(output), state='queued', next='Call job_status with this job_id')

class JobFailure(Exception):
    def __init__(self, code, message):
        super().__init__(message); self.code=code

def worker(jid):
    spec = JOBS / (jid + '.json'); job = json.loads(spec.read_text(encoding='utf-8'))
    try:
        job['state'] = 'running'; job['pid'] = os.getpid(); save(spec, job)
        output = Path(job['output']); output.mkdir(parents=True, exist_ok=False)
        args = job['args']
        if job['kind'] == 'gallery':
            from dotenv import dotenv_values
            token = dotenv_values(BASE / 'pixiv.env').get('PIXIV_REFRESH_TOKEN')
            if not token: raise JobFailure('login_required','Pixiv login is not configured. Use the login shortcut; never paste credentials into chat.')
            import gallery_dl.config as config
            from gallery_dl.job import DownloadJob
            config.clear()
            config.set(('extractor',), 'base-directory', str(output))
            config.set(('extractor',), 'archive', str(DATA / 'gallery-downloads.sqlite3'))
            config.set(('extractor',), 'post-range', '1-' + str(args['limit']))
            if PRIVATE_MEMORY:
                # pyfakefs treats Windows extended paths as a separate virtual tree.
                config.set(('extractor',), 'path-extended', False)
            config.set(('extractor',), 'postprocessors', [{'name':'metadata','mode':'json'}])
            config.set(('extractor','pixiv'), 'refresh-token', token)
            code = DownloadJob(args['url']).run()
            if code:
                if code & 16: raise JobFailure('authentication_or_permission','Pixiv authentication or permission check failed. Verify account login; do not copy token contents into chat.')
                raise JobFailure('download_failed','The downloader reported a failure (exit status '+str(code)+'). No successful completion was reported.')
        else:
            from waifuc.source import LocalSource
            from waifuc.action import ModeConvertAction, FilterSimilarAction, PersonSplitAction, CCIPAction, TaggingAction, AlignMinSizeAction
            from waifuc.export import TextualInversionExporter
            actions = [ModeConvertAction('RGB','white')]
            if args['deduplicate']: actions.append(FilterSimilarAction('all'))
            if args['crop_people']: actions.append(PersonSplitAction())
            if args['filter_character']: actions.append(CCIPAction(min_val_count=15))
            actions.append(AlignMinSizeAction(args['size']))
            if args['tag']: actions.append(TaggingAction(force=True))
            source = LocalSource(str(local_folder(args['input_dir'])))[:args['limit']]
            source.attach(*actions).export(TextualInversionExporter(str(output)))
        images=sum(p.is_file() and p.suffix.lower() in {'.jpg','.jpeg','.png','.webp','.gif'} for p in output.rglob('*'))
        if images == 0: raise JobFailure('no_output','No image files were produced. This is not a successful download/dataset; possible causes include no matching items, access restrictions, or archive skips.')
        job.update(state='completed', images=images)
    except Exception as e:
        # Do not persist upstream authentication responses or tokens.
        job.update(state='failed', error_code=e.code if isinstance(e,JobFailure) else 'processing_failed', error=str(e) if isinstance(e,JobFailure) else 'Processing failed; upstream exception text was withheld to protect credentials.')
        print('Job failed: '+job['error_code'],file=sys.stderr)
    save(spec, job)

if __name__ == '__main__' and len(sys.argv)>1 and sys.argv[1]=='--worker':
    worker(sys.argv[2]); sys.exit()

from mcp.server.fastmcp import FastMCP
mcp = FastMCP('Private art dataset tools', instructions='Use tool_status to find the owner-specific input/output root. Original inputs are retained. Poll job_status for background jobs. CPU processing. Never request tokens in chat.')

@mcp.tool()
def tool_status() -> dict:
    """Check installed packages, paths and whether Pixiv login is configured; never returns credentials."""
    from importlib.metadata import version
    from dotenv import dotenv_values
    return dict(packages={p:version(p) for p in ['waifuc','gallery-dl','onnxruntime']}, data_root=str(DATA), pixiv_login_configured=bool(dotenv_values(BASE/'pixiv.env').get('PIXIV_REFRESH_TOKEN')), processing='CPU')

@mcp.tool()
def gallery_download(url: str, limit: int = 20) -> dict:
    """Download a selected Pixiv artwork/artist/bookmark URL with gallery-dl, metadata and archive tracking. Requires login. Limit 1..200 gallery items (multi-page artworks can contain more image files)."""
    u=urlparse(url)
    if u.scheme!='https' or u.hostname not in {'www.pixiv.net','pixiv.net'} or u.username or u.password or u.port not in {None,443}:
        raise ValueError('Use a https://www.pixiv.net/ URL')
    if not 1<=limit<=200: raise ValueError('limit must be 1..200')
    return launch('gallery', dict(url=url,limit=limit))

@mcp.tool()
def prepare_dataset(input_dir: str, limit: int = 100, size: int = 1024, deduplicate: bool = True, tag: bool = True, crop_people: bool = False, filter_character: bool = False) -> dict:
    """Run waifuc on a folder inside the current model's private root (see tool_status). Creates a new dataset with images + TXT captions. Optional perceptual deduplication, person crops and dominant-character filtering. Never overwrites originals."""
    local_folder(input_dir)
    if not 1<=limit<=1000 or not 256<=size<=2048: raise ValueError('limit 1..1000, size 256..2048')
    if filter_character and limit<15: raise ValueError('Character filtering requires at least 15 input images')
    return launch('waifuc',dict(input_dir=input_dir,limit=limit,size=size,deduplicate=deduplicate,tag=tag,crop_people=crop_people,filter_character=filter_character))

@mcp.tool()
def job_status(job_id: str) -> dict:
    """Get a background download/dataset job result. Zero-image output reports failed/no_output rather than completed."""
    if not re.fullmatch('[a-f0-9]{32}',job_id): raise ValueError('Invalid job ID')
    return json.loads((JOBS/(job_id+'.json')).read_text(encoding='utf-8'))

if __name__=='__main__': mcp.run(transport='stdio')
