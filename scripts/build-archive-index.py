"""Build a public discovery snapshot from existing catalogs and recovery exports.

Usage: python3 scripts/build-archive-index.py /path/to/automation-audit
Original metadata and artistic assets are not changed. Reported identities are
kept distinct from usable viewer routes and CID-verified metadata.
"""
import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIT = Path(sys.argv[1])
from importlib.util import spec_from_file_location, module_from_spec
spec = spec_from_file_location('supper_import', ROOT / 'scripts/import-supper-zip.py')
verifier = module_from_spec(spec)
spec.loader.exec_module(verifier)
records = []
by_identity = {}
by_cid = {}
by_id = {}
catalog_conflicts = []
V2 = '0xb6dae651468e9593e4581705a09c10a76ac1e0c8'
V1 = '0x6c424c25e9f1fff9642cb5b7750b0db7312c29ad'

def cid_of(value):
    match = re.search(r'Qm[1-9A-HJ-NP-Za-km-z]{44}', value or '')
    return match[0] if match else ''

def add(row):
    if row['id'] in by_id:
        previous = by_id[row['id']]
        if row['kind'] != previous['kind']:
            catalog_conflicts.append({'id':row['id'], 'kinds':[previous['kind'], row['kind']]})
        if not previous['artist']:
            previous['artist'] = row['artist']
        return
    records.append(row)
    by_id[row['id']] = row
    if row.get('contractAddress') and row.get('tokenId') is not None:
        by_identity.setdefault((row['contractAddress'].lower(), row['tokenId']), row)
    if row.get('cid'):
        by_cid.setdefault(row['cid'], row)

for filename, kind in [('masters.json', 'Master'), ('layers.json', 'Layer')]:
    data = json.loads((ROOT / 'src' / filename).read_text())
    for contract, rows in data.items():
        for raw in rows:
            address = contract.lower()
            token = str(raw['tokenId'])
            version = 'v2' if address == V2 else 'v1' if address == V1 else None
            link = (f'/{version}/{token}?referrer=search' if kind == 'Master'
                    else f'/layer/{address}/{token}') if version else None
            add(dict(id=f'{address}:{token}', name=raw['name'],
                     artist=raw.get('artistName', ''), description=raw.get('description') or '',
                     family='classic', kind=kind, tokenId=token,
                     contractAddress=address, cid=cid_of(raw.get('metadataUri')),
                     link=link, source='Existing archive catalog',
                     identityStatus='catalog', metadataVerified=False,
                     image=raw.get('imageUrl') or '', imageSource='Existing archive catalog'))

sheet = json.loads((AUDIT / 'sheet-inventory.json').read_text())
music_identities = []
for raw in sheet['records']:
    contract, token = raw.get('contractAddress'), raw.get('tokenId')
    asset_type = raw.get('assetTypeRaw') or ''
    if asset_type not in ('Master (Art)', 'Layer (Art)', 'Master (Music)', 'Stem (Music)'):
        family, kind = 'unclassified', 'Archive record'
    else:
        family = 'music' if 'Music' in asset_type else 'classic'
        kind = asset_type.split(' (')[0]
    if family == 'music' and kind == 'Master' and contract and raw.get('metadataComparison') == 'match':
        music_identities.append(dict(contractAddress=contract.lower(), tokenId=token))
    existing = by_identity.get((contract.lower(), token)) if contract else None
    if existing:
        if family != 'unclassified':
            existing['family'], existing['kind'] = family, kind
        if not existing['artist']:
            existing['artist'] = raw.get('artistsRaw') or ''
        if not existing['cid'] and raw.get('metadataCid'):
            existing['cid'] = raw['metadataCid']
            by_cid.setdefault(existing['cid'], existing)
        continue
    if not raw.get('titleRaw'):
        continue
    add(dict(id=f'sheet:{raw["sourceRow"]}', name=raw['titleRaw'],
             artist=raw.get('artistsRaw') or '', description='', family=family,
             kind=kind, tokenId=token or '', contractAddress=contract or '',
             cid=raw.get('metadataCid') or '', link=None,
             source='Community recovery inventory', identityStatus='reported', metadataVerified=False))

with (AUDIT / 'sources/forever_supper_pinlist.csv').open(encoding='utf-8-sig', newline='') as f:
    pins = {r['metadata_cid'] for r in csv.DictReader(f)}
retrieved = json.loads((AUDIT / 'supper-pinlist-retrieval.json').read_text())
verified = {r['metadataCid']: r for r in retrieved['records'] if r['status'] == 'retrieved-cid-verified'}
with (AUDIT / 'sources/project_manifest.csv').open(encoding='utf-8-sig', newline='') as f:
    for raw in csv.DictReader(f):
        cid = raw['cid']
        if cid in by_cid:
            existing = by_cid[cid]
            if not existing['artist']:
                existing['artist'] = raw['artist']
            continue
        edition = re.fullmatch(r'(0x[0-9a-fA-F]{40})-(\d+)', raw['edition'])
        family = 'dynamic-blueprints' if cid in pins else 'blueprints' if raw['blueprint'] != 'unknown' else 'unclassified'
        observed = verified.get(cid, {})
        add(dict(id=f'cid:{cid}', name=raw['project_name'], artist=raw['artist'], description='',
                 family=family, kind='Expansion item' if cid in pins else 'Edition' if edition else 'Metadata record',
                 tokenId=edition[2] if edition else '', contractAddress=edition[1].lower() if edition else '',
                 coreAddress=observed.get('coreContract', ''), cid=cid, link=None,
                 source='Supplied project manifest', identityStatus='reported',
                 metadataVerified=bool(observed), blueprintId=raw['blueprint'] if raw['blueprint'] != 'unknown' else ''))

# Enrich only from preserved original metadata bytes; retain reported identity.
preview_report_path = AUDIT / 'preview-retrieval.json'
preview_report = json.loads(preview_report_path.read_text()) if preview_report_path.exists() else {}
zip_report_path = AUDIT / 'supper-zip-import.json'
zip_report = json.loads(zip_report_path.read_text()).get('records', {}) if zip_report_path.exists() else {}
cached_files = {}
for directory in ('supper-metadata', 'preview-metadata', 'supper-zip-metadata'):
    for path in (AUDIT / directory).glob('*.json'):
        cached_files[path.stem] = path
for record in records:
    cid = record.get('cid')
    if not cid:
        continue
    for path in ([cached_files[cid]] if cid in cached_files else []):
        if path.parent.name == 'supper-zip-metadata':
            if not zip_report.get(cid, {}).get('cidVerified') or not verifier.verify(cid, path.read_bytes()):
                raise ValueError('Unverified ZIP cache: ' + cid)
            destination = ROOT / 'public/archive/metadata' / (cid + '.json')
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(path.read_bytes())
            record['metadataLocal'] = True
            record['metadataVerified'] = True
        data = json.loads(path.read_text())
        if not isinstance(data, dict):
            continue
        if record.get('metadataLocal'):
            async_data = data.get('async-attributes') or {}
            core = async_data.get('dbpContractAddress')
            if isinstance(core, str) and re.fullmatch(r'0x[0-9a-fA-F]{40}', core):
                record['coreAddress'] = core.lower()
            for attribute in data.get('attributes', []):
                if not isinstance(attribute, dict) or not isinstance(attribute.get('value'), str):
                    continue
                if attribute.get('trait_type') == 'Artist' and not record['artist']:
                    record['artist'] = attribute['value']
                if attribute.get('trait_type') == 'Slot':
                    record['slot'] = attribute['value']
        image = data.get('image') or data.get('image_url')
        if isinstance(image, str) and image.startswith(('ipfs://', 'https://', 'Qm', 'bafy')):
            record['image'] = image
            record['imageSource'] = 'Original metadata'
        if not record['description'] and isinstance(data.get('description'), str):
            record['description'] = data['description'][:10000]
        for attribute in data.get('attributes', []):
            if isinstance(attribute, dict) and attribute.get('trait_type') in ('Collection', 'Core') and isinstance(attribute.get('value'), str):
                record['collection'] = attribute['value']
        record['metadataVerified'] = record['metadataVerified'] or bool(preview_report.get(cid, {}).get('cidVerified'))
        break

# Compact immutable discovery snapshot; original source bytes stay in the recovery archive.
out = ROOT / 'src/data'
out.mkdir(exist_ok=True)
(out / 'archive-index.json').write_text(json.dumps(dict(
    generatedOn='2026-11-07', records=records,
    counts=dict(Counter(r['family'] for r in records)),
    coverage='Known local catalogs and supplied recovery inventories; not a complete on-chain census.',
), ensure_ascii=False, indent=2), encoding='utf-8')
(out / 'music-identities.json').write_text(json.dumps(music_identities, indent=2), encoding='utf-8')
assert len({r['id'] for r in records}) == len(records)
print(json.dumps({'records':len(records), 'families':dict(Counter(r['family'] for r in records)), 'musicMasters':len(music_identities), 'catalogConflicts':catalog_conflicts}))

# Reapply independently preserved on-chain edition recoveries after the source import.
import subprocess
subprocess.run([sys.executable, str(ROOT / 'scripts/merge-blueprint-recovery.py')], check=True)
