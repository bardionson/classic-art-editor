"""Recover original metadata bytes for preview indexing; resumable, bounded, read-only.

python3 scripts/recover-archive-previews.py /path/to/automation-audit --limit 96
No pins, tokens, or original files are changed. Failed retrieval is not proof of loss.
"""
import argparse
import concurrent.futures
import hashlib
import json
import threading
import urllib.request
import urllib.error
from pathlib import Path

STOP = threading.Event()

def varint(n):
    out = bytearray()
    while n >= 128:
        out.append((n & 127) | 128)
        n >>= 7
    return bytes(out + bytes([n]))

def verify(cid, body):
    # Single-block UnixFS CIDv0. Other import layouts remain explicitly unverified.
    data = b'\x08\x02\x12' + varint(len(body)) + body + b'\x18' + varint(len(body))
    node = b'\x0a' + varint(len(data)) + data
    alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    n = 0
    for char in cid:
        n = n * 58 + alphabet.index(char)
    return n.to_bytes((n.bit_length() + 7) // 8, 'big') == b'\x12\x20' + hashlib.sha256(node).digest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('audit')
    parser.add_argument('--limit', type=int, default=96)
    args = parser.parse_args()
    root = Path(args.audit)
    cache = root / 'preview-metadata'
    cache.mkdir(exist_ok=True)
    index = json.loads((Path(__file__).resolve().parents[1] / 'src/data/archive-index.json').read_text())
    report_path = root / 'preview-retrieval.json'
    prior = json.loads(report_path.read_text()) if report_path.exists() else {}
    records = [r for r in index['records'] if r['family'] in ('blueprints', 'dynamic-blueprints') and r['cid']]
    records.sort(key=lambda r: (r['family'] != 'blueprints', r['name'].casefold(), r['id']))
    # Seed visible catalog pages and a known representative, then continue in catalog order.
    seed = [r for r in records if r['name'] == 'Atemporal #10']
    for family in ('blueprints', 'dynamic-blueprints'):
        seed += [r for r in records if r['family'] == family][:24]
    unique = {r['cid']: r for r in seed + records}
    todo = [r for r in unique.values() if not (cache / (r['cid'] + '.json')).exists()][:args.limit]

    def retrieve(row):
        cid = row['cid']
        if STOP.is_set():
            return cid, {'status': 'deferred-rate-limit'}
        for gateway in ('https://gateway.pinata.cloud/ipfs/', 'https://ipfs.io/ipfs/'):
            try:
                request = urllib.request.Request(gateway + cid, headers={'User-Agent': 'AsyncArchiveRecovery/1.0'})
                with urllib.request.urlopen(request, timeout=10) as response:
                    body = response.read(2_000_001)
                if len(body) > 2_000_000:
                    continue
                metadata = json.loads(body)
                if not isinstance(metadata, dict):
                    continue
                (cache / (cid + '.json')).write_bytes(body)
                return cid, {'status': 'retrieved', 'cidVerified': verify(cid, body), 'source': gateway + cid,
                             'sha256': hashlib.sha256(body).hexdigest(), 'image': metadata.get('image', metadata.get('image_url', ''))}
            except urllib.error.HTTPError as error:
                if error.code == 429:
                    STOP.set()
                    return cid, {'status': 'rate-limited'}
            except Exception:
                pass
        return cid, {'status': 'unavailable-on-checked-gateways'}

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        for i, (cid, result) in enumerate(executor.map(retrieve, todo), 1):
            prior[cid] = result
            report_path.write_text(json.dumps(prior, indent=2), encoding='utf-8')
            if i % 12 == 0:
                print(json.dumps({'processed': i, 'of': len(todo), 'retrieved': sum(r['status'] == 'retrieved' for r in prior.values())}), flush=True)
    print(json.dumps({'attempted': len(prior), 'retrieved': sum(r['status'] == 'retrieved' for r in prior.values())}), flush=True)

if __name__ == '__main__':
    main()
