"""Check every portable file and compare custom application files with this checkout."""
import argparse
import json
from pathlib import Path
from build_support import ROOT, digest, inputs, source_state, tree_files

def verify(folder, require_clean=False):
    folder=Path(folder).resolve()
    manifest=json.loads((folder/'BUILD.json').read_text(encoding='utf-8'))
    current=source_state()
    if require_clean and (current['dirty'] or manifest['source']['dirty']):
        raise ValueError('Release verification requires a clean source checkout')
    if manifest['source'] != current:
        raise ValueError('Build source identity differs from this checkout')
    files=tree_files(folder,exclude={'BUILD.json'})
    if files != manifest['files']:
        raise ValueError('Portable files differ from the build manifest')
    checked=0
    for area,target in [('app','resources/private/app'),('desktop-overrides','resources/app/lib'),('docs','docs'),('licenses','licenses')]:
        for p in (ROOT/area).rglob('*'):
            if not p.is_file() or '__pycache__' in p.parts: continue
            rel=p.relative_to(ROOT/area).as_posix()
            if files.get(target+'/'+rel) != digest(p): raise ValueError('Source mismatch: '+area+'/'+rel)
            checked+=1
    for name in ['README.md','README.zh-CN.md','LICENSE','NOTICE.md','SECURITY.md']:
        if files.get(name)!=digest(ROOT/name): raise ValueError('Packaged document differs from source: '+name)
    if files.get('resources/app/private-entry.mjs') != digest(ROOT/'app-entry.mjs'):
        raise ValueError('Application entry point differs from source')
    if files.get('resources/private/app/runtime/node.exe') != inputs()['node']['sha256']:
        raise ValueError('Bundled Node differs from the pinned input')
    desktop=inputs()['desktop']
    if manifest['upstream']['archiveSha256']!=desktop['sha256'] or manifest['upstream']['treeSha256']!=desktop['treeSha256']:
        raise ValueError('Unrecognized upstream provenance')
    return {'sourceCommit':current['commit'],'sourceDirty':current['dirty'],'filesVerified':len(files),'customSourceFilesCompared':checked+1,'nodePinned':True,'upstreamPinned':True}

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('folder',type=Path)
    parser.add_argument('--require-clean-source',action='store_true')
    parser.add_argument('--report',type=Path)
    args=parser.parse_args()
    result=verify(args.folder,args.require_clean_source)
    if args.report: args.report.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,indent=2))
