"""Derive the exact immutable IPFS allowlist from preserved Dynamic Blueprint metadata.
No network. Neither metadata nor archive records are changed.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CID_PATH = re.compile(r'(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})(?:/[^?#\\]+)?')

def ipfs_path(value):
    if not isinstance(value, str):
        return None
    path = value.removeprefix('ipfs://').removeprefix('ipfs/')
    if not CID_PATH.fullmatch(path) or any(p in ('.', '..') for p in path.split('/')):
        return None
    return path

def main():
    records = json.loads((ROOT / 'src/data/archive-index.json').read_text(encoding='utf-8'))['records']
    paths = set()
    for record in records:
        if record['family'] != 'dynamic-blueprints':
            continue
        cover = ipfs_path(record.get('image'))
        if cover:
            paths.add(cover)
        if not record.get('metadataVerified') or not record.get('metadataLocal'):
            continue
        metadata = json.loads((ROOT / 'public/archive/metadata' / (record['cid'] + '.json')).read_text(encoding='utf-8'))
        for variation in metadata.get('async-attributes', {}).get('dbpTypes', []):
            for layer in variation.get('layers', []):
                state = ipfs_path(layer.get('state', {}).get('uri'))
                if state:
                    paths.add(state)
    (ROOT / 'src/data/archive-image-sources.json').write_text(json.dumps(sorted(paths), indent=2) + '\n', encoding='utf-8')
    print(f'{len(paths)} original IPFS paths allowlisted')

if __name__ == '__main__':
    main()
