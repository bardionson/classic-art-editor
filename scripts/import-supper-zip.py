"""Recover CID-verified metadata from a supplied wrapped JSON ZIP export.

Never extract archive paths or execute contents. Only publish recovered bytes
when their single-block UnixFS SHA-256 multihash matches the named CIDv0.
Usage: python3 scripts/import-supper-zip.py ZIP AUDIT_DIRECTORY
"""
import csv
import hashlib
import json
import re
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path, PurePosixPath

CID = re.compile(r'Qm[1-9A-HJ-NP-Za-km-z]{44}')
CORE = '0xf62d291a22886fa0b81e5b13c7b6dab2d4c33f31'


def varint(n):
    out = bytearray()
    while n >= 128:
        out.append((n & 127) | 128)
        n >>= 7
    return bytes(out + bytes([n]))


def verify(cid, body):
    data = b'\x08\x02\x12' + varint(len(body)) + body + b'\x18' + varint(len(body))
    node = b'\x0a' + varint(len(data)) + data
    alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    number = 0
    for char in cid:
        number = number * 58 + alphabet.index(char)
    return number.to_bytes((number.bit_length() + 7) // 8, 'big') == b'\x12\x20' + hashlib.sha256(node).digest()


def import_zip(source, audit):
    archive_bytes = source.read_bytes()
    report = {'source': source.name, 'archiveSha256': hashlib.sha256(archive_bytes).hexdigest(),
              'verification': 'CIDv0 single-block UnixFS; reconstructed compact JSON accepted only on exact hash match',
              'records': {}, 'rejected': [], 'groups': {}}
    cache = audit / 'supper-zip-metadata'
    cache.mkdir(parents=True, exist_ok=True)
    groups = defaultdict(lambda: {'count': 0, 'collections': Counter(), 'slots': Counter(), 'assets': set()})
    with zipfile.ZipFile(source) as archive:
        entries = archive.infolist()
        if len(entries) > 20000 or sum(i.file_size for i in entries) > 100_000_000:
            raise ValueError('Archive exceeds import limits')
        for entry in entries:
            if entry.is_dir() or entry.filename.startswith('__MACOSX/') or not entry.filename.endswith('.json'):
                continue
            path = PurePosixPath(entry.filename)
            if path.is_absolute() or '..' in path.parts or entry.file_size > 2_000_000 or not CID.fullmatch(path.stem):
                raise ValueError('Unsafe or unsupported entry: ' + entry.filename)
            cid = path.stem
            raw = archive.read(entry)
            wrapped = json.loads(raw)
            metadata = wrapped.get(cid) if isinstance(wrapped, dict) and set(wrapped) == {cid} else wrapped
            if not isinstance(metadata, dict):
                report['rejected'].append({'entry': entry.filename, 'reason': 'Not a metadata object'})
                continue
            candidates = [('original entry bytes', raw),
                          ('unwrapped compact UTF-8 JSON', json.dumps(metadata, ensure_ascii=False, separators=(',', ':')).encode()),
                          ('unwrapped compact ASCII JSON', json.dumps(metadata, ensure_ascii=True, separators=(',', ':')).encode())]
            matched = next(((encoding, body) for encoding, body in candidates if verify(cid, body)), None)
            if not matched:
                report['rejected'].append({'entry': entry.filename, 'cid': cid, 'reason': 'No candidate encoding matched CID'})
                continue
            encoding, body = matched
            destination = cache / (cid + '.json')
            if destination.exists() and destination.read_bytes() != body:
                raise ValueError('Conflicting existing cache: ' + cid)
            destination.write_bytes(body)
            async_data = metadata.get('async-attributes') or {}
            core = str(async_data.get('dbpContractAddress') or '').lower()
            attrs = {a.get('trait_type'): a.get('value') for a in metadata.get('attributes', []) if isinstance(a, dict)}
            assets = set()
            def collect(value):
                if isinstance(value, str):
                    assets.update(CID.findall(value))
                elif isinstance(value, dict):
                    for child in value.values():
                        collect(child)
                elif isinstance(value, list):
                    for child in value:
                        collect(child)
            collect(metadata)
            row = {'cidVerified': True, 'entry': entry.filename, 'encoding': encoding,
                   'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body),
                   'name': metadata.get('name'), 'coreAddress': core,
                   'collection': attrs.get('Core'), 'slot': attrs.get('Slot'),
                   'image': metadata.get('image'), 'assetCids': sorted(assets)}
            if cid in report['records']:
                raise ValueError('Duplicate CID entry: ' + cid)
            report['records'][cid] = row
            group = groups[core or 'unknown']
            group['count'] += 1
            group['collections'][str(attrs.get('Core', 'unknown'))] += 1
            group['slots'][str(attrs.get('Slot', 'unknown'))] += 1
            group['assets'].update(assets)
    for core, group in groups.items():
        report['groups'][core] = dict(count=group['count'], collections=dict(group['collections']),
                                     slots=dict(group['slots']), assetCids=sorted(group['assets']))
    with (audit / 'sources/forever_supper_pinlist.csv').open(encoding='utf-8-sig', newline='') as handle:
        pins = {r['metadata_cid'] for r in csv.DictReader(handle)}
    report['missingPinlistCids'] = sorted(pins - report['records'].keys())
    report['extraCids'] = sorted(report['records'].keys() - pins)
    report['knownForeverSupperCore'] = CORE
    report['summary'] = {'verifiedMetadata': len(report['records']), 'rejected': len(report['rejected']),
                         'coreGroups': len(groups), 'knownForeverSupperItems': groups[CORE]['count'],
                         'uniqueReferencedCids': len(set().union(*(g['assets'] for g in groups.values())))}
    (audit / 'sources/forever_supper.zip').write_bytes(archive_bytes)
    (audit / 'supper-zip-import.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report['summary']))
    print(json.dumps({c: {'count': g['count'], 'collections': dict(g['collections']), 'slots': len(g['slots'])} for c, g in groups.items()}, ensure_ascii=False))


if __name__ == '__main__':
    import_zip(Path(sys.argv[1]), Path(sys.argv[2]))
