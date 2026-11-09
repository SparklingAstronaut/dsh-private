from portable_paths import private_path
import os
from pathlib import Path
from dotenv import load_dotenv
root=Path(__file__).resolve().parent
owner=os.environ.get('PRIVATE_ART_OWNER')
if owner not in {'Heretic','QQZ'}: raise RuntimeError('Private model owner missing')
load_dotenv(root/'pixiv.env',override=True)
os.environ['DOWNLOAD_PATH']=private_path("private/")+owner+'/pixiv'
os.environ['PREVIEW_PROXY_HOST']='127.0.0.1'
os.environ['PREVIEW_PROXY_PORT']='8643' if owner=='Heretic' else '8644'
os.environ['DOWNLOAD_SEMAPHORE']='2'
from pixiv_mcp_server.__main__ import main
main()
