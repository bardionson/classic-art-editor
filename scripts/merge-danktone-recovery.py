#!/usr/bin/env python3
"""Stage and merge the CID-verified Danktone recovery."""
import argparse
import hashlib
import importlib.util
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RECOVERY = Path('/mnt/c/projects/asyncart/danktone-recovery')
TARGETS = {
    '6299ca161f3e98af7d976a6f': 'h0m3w0rk',
    '63bf30d6874e8e6af40f1c31': 'Danktone 000',
    '63d6f5db3c0cbf340f528699': 'Danktone 003',
    '63ed56a882b726f72c1b3c95': 'Danktone 004',
    '6421c2008973a69687b3d75b': 'Danktone 005',
    '64d288613d7854eb2846447b': 'Danktone 006',
    '64f8d28b6763d160c98ed504': 'Danktone 007',
}
EDITION = re.compile(r'(0x[0-9a-fA-F]{40})-(\d+)\Z')
CID = re.compile(r'Qm[1-9A-HJ-NP-Za-km-z]{44}\Z')
spec = importlib.util.spec_from_file_location('cid_verifier', ROOT / 'scripts/import-supper-zip.py')
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


def read_verified(path, cid, expected_sha=None, expected_bytes=None):
    raw = Path(path).read_bytes()
    if not CID.fullmatch(cid) or not verifier.verify(cid, raw):
        raise ValueError(f'CID verification failed for {cid}: {path}')
    digest = hashlib.sha256(raw).hexdigest()
    if expected_sha and digest != expected_sha:
        raise ValueError(f'SHA-256 mismatch for {cid}: {path}')
    if expected_bytes and len(raw) != expected_bytes:
        raise ValueError(f'Byte count mismatch for {cid}: {path}')
    metadata = json.loads(raw)
    if not isinstance(metadata, dict):
        raise ValueError(f'Metadata JSON must be an object: {cid}')
    return raw, metadata, digest


def traits(metadata):
    return {a.get('trait_type'): a.get('value') for a in metadata.get('attributes', [])
            if isinstance(a, dict) and isinstance(a.get('trait_type'), str)}


def media_cid(uri):
    if not isinstance(uri, str):
        return None
    match = re.fullmatch(r'(?:ipfs://)?(Qm[1-9A-HJ-NP-Za-km-z]{44}(?:/[^\s]*)?)', uri)
    return match.group(1) if match else None


def build_report():
    main = json.loads((RECOVERY / 'recovery-manifest.json').read_text())
    extra = json.loads((RECOVERY / 'extra-mints-report.json').read_text())
    entries = []
    copied = {}
    for row in main['recovery']:
        project = row.get('blueprintId')
        if project not in TARGETS:
            continue
        if row.get('status') != 'cid-verified':
            raise ValueError(f'Unverified metadata remains for {project}: {row.get("cid")}')
        edition = EDITION.fullmatch(row.get('manifestEdition') or '')
        if not edition:
            raise ValueError(f'Invalid/missing 40-hex edition identity: {row.get("manifestEdition")}')
        contract, token = edition.group(1).lower(), edition.group(2)
        cid = row['cid']
        raw, metadata, digest = read_verified(row['path'], cid, row.get('sha256'), row.get('bytes'))
        external = metadata.get('external_url')
        expected_external = f'https://async.market/blueprints/{project}/editions/{contract}-{token}'
        external_match = external == expected_external
        if not external_match:
            raise ValueError(f'External metadata identity does not match manifest edition: {cid}')
        attrs = traits(metadata)
        collection = attrs.get('Collection')
        if collection != TARGETS[project]:
            raise ValueError(f'Collection does not match expected target for {cid}: {collection!r}')
        entry = {
            'recordId': f'cid:{cid}', 'projectId': project, 'collection': collection,
            'name': metadata.get('name') or '', 'artist': attrs.get('Artist') or '',
            'description': metadata.get('description') or '', 'contractAddress': contract,
            'tokenId': token, 'edition': f'{contract}-{token}', 'cid': cid,
            'metadataUri': f'ipfs://{cid}', 'externalUrl': external,
            'externalUrlMatchesManifestIdentity': external_match,
            'identityStatus': 'reported',
            'verification': {'metadataCIDv0': True, 'sha256': digest, 'bytes': len(raw),
                             'identityBasis': 'project manifest edition plus original metadata external_url; not an individual tokenURI/on-chain claim'},
            'image': metadata.get('image'), 'animationUrl': metadata.get('animation_url'),
            'attributes': metadata.get('attributes', []), 'signatures': (metadata.get('async-attributes') or {}).get('signatures', []),
        }
        entries.append(entry)
        copied[cid] = raw

    for row in extra['extras']:
        recovery = row.get('metadataRecovery') or {}
        if recovery.get('status') != 'file-cid-verified':
            raise ValueError(f'Extra token metadata not file-CID verified: {row.get("contract")}#{row.get("tokenId")}')
        contract, token, project, cid = row['contract'].lower(), str(row['tokenId']), row['projectId'], recovery.get('fileCid')
        if project not in TARGETS or not CID.fullmatch(cid or ''):
            raise ValueError(f'Invalid extra metadata identity/CID: {row}')
        raw, metadata, digest = read_verified(recovery['path'], cid, recovery.get('sha256'), recovery.get('bytes'))
        external = metadata.get('external_url')
        expected_external = f'https://async.market/blueprints/{project}/editions/{contract}-{token}'
        if row.get('tokenURI') != f"ipfs://{row['cid']}/{token}/token.json" or external != expected_external:
            raise ValueError(f'Extra tokenURI/external_url identity mismatch: {contract}#{token}')
        attrs = traits(metadata)
        collection = attrs.get('Collection')
        if collection != TARGETS[project]:
            raise ValueError(f'Extra Collection does not match expected target: {collection!r}')
        entries.append({
            'recordId': f'cid:{cid}', 'projectId': project, 'collection': collection,
            'name': metadata.get('name') or '', 'artist': attrs.get('Artist') or '',
            'description': metadata.get('description') or '', 'contractAddress': contract,
            'tokenId': token, 'edition': f'{contract}-{token}', 'cid': cid,
            'metadataUri': row['tokenURI'], 'tokenURI': row['tokenURI'],
            'directoryCid': row['cid'], 'externalUrl': external,
            'externalUrlMatchesManifestIdentity': True,
            'identityStatus': 'verified',
            'verification': {'metadataFileCIDv0': True, 'sha256': digest, 'bytes': len(raw),
                             'identityBasis': 'tokenURI called for exact contract/tokenId; metadata external_url matches; Pinata ETag/X-Ipfs-Roots file CID matches exact bytes'},
            'image': metadata.get('image'), 'animationUrl': metadata.get('animation_url'),
            'attributes': metadata.get('attributes', []), 'signatures': (metadata.get('async-attributes') or {}).get('signatures', []),
        })
        copied[cid] = raw

    seen = set()
    seen_cids = set()
    for entry in entries:
        key = (entry['contractAddress'], entry['tokenId'])
        if key in seen:
            raise ValueError(f'Duplicate edition identity {key}')
        if entry['cid'] in seen_cids:
            raise ValueError(f'Duplicate metadata CID {entry["cid"]}')
        seen.add(key)
        seen_cids.add(entry['cid'])

    # Preserve bounded contract scans as raw evidence without assigning a shared
    # H0m3 contract count to the project: only 12 of its 819 scanned tokens have
    # project metadata identities in this recovery. S1E4 likewise remains unaudited.
    chain_path = RECOVERY / 'chain-reconciliation.json'
    chain = json.loads(chain_path.read_text())
    contract_by_project = {}
    for entry in entries:
        contract_by_project.setdefault(entry['projectId'], set()).add(entry['contractAddress'])
    mint_evidence = {row['address']: row for row in chain.get('mintLogs', [])}
    coverage = {}
    contract_scans = []
    for contract in sorted({c for contracts in contract_by_project.values() for c in contracts}):
        evidence = mint_evidence.get(contract)
        if not evidence:
            continue
        contract_scans.append({'contractAddress': contract, 'fromBlock': evidence['fromBlock'],
                               'throughBlock': chain['throughBlock'], 'status': evidence['status'],
                               'mintedTokenCount': evidence.get('mintTokenCount'),
                               'mintLogCount': evidence.get('mintLogCount'),
                               'mintTokenIds': evidence.get('mintTokenIds', [])})
    for project_id, contracts in contract_by_project.items():
        if project_id in {'6299ca161f3e98af7d976a6f', '63bf30d6874e8e6af40f1c31',
                          '63ed56a882b726f72c1b3c95'}:
            continue
        if len(contracts) != 1:
            continue
        contract = next(iter(contracts))
        evidence = mint_evidence.get(contract)
        if not evidence or evidence.get('status') != 'complete-since-14m':
            continue
        ids = evidence.get('mintTokenIds') or []
        if len(ids) != evidence.get('mintTokenCount'):
            raise ValueError(f'Mint-log token count mismatch for {contract}')
        project_ids = {entry['tokenId'] for entry in entries if entry['projectId'] == project_id}
        if {str(token_id) for token_id in ids} != project_ids:
            continue
        coverage[project_id] = {'contractAddress': contract, 'fromBlock': evidence['fromBlock'],
                                'throughBlock': chain['throughBlock'], 'mintedTokenIds': ids,
                                'mintedTokenCount': evidence['mintTokenCount'],
                                'mintLogCount': evidence['mintLogCount'],
                                'status': evidence['status']}
    return {'schemaVersion': 1, 'generatedBy': 'scripts/merge-danktone-recovery.py',
            'scope': 'Seven Danktone/H0m3w0rk projects; original metadata only; no media files copied.',
            'coverageNote': 'Project coverage is included only where verified metadata token IDs exactly match a complete contract mint-log scan. H0m3w0rk contract-level counts are preserved below without assigning all scanned tokens to that project; S1E0 was not fully scanned and S1E4 remains unaudited.',
            'projects': [{'id': pid, 'name': name} for pid, name in TARGETS.items()],
            'coverageEvidence': coverage, 'contractScanEvidence': contract_scans,
            'records': entries}, copied


def stage():
    report, copied = build_report()
    recovery_dir = ROOT / 'public/archive/recovery'
    metadata_dir = ROOT / 'public/archive/metadata'
    recovery_dir.mkdir(parents=True, exist_ok=True)
    metadata_dir.mkdir(parents=True, exist_ok=True)
    report_path = recovery_dir / 'danktone-metadata.json'
    serialized = (json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode()
    if report_path.exists() and report_path.read_bytes() != serialized:
        old = json.loads(report_path.read_text(encoding='utf-8'))
        if old.get('generatedBy') != report['generatedBy'] or old.get('records') != report['records']:
            raise ValueError(f'Refusing to replace a different recovery report: {report_path}')
    report_path.write_bytes(serialized)
    for cid, body in copied.items():
        destination = metadata_dir / f'{cid}.json'
        if destination.exists() and destination.read_bytes() != body:
            raise ValueError(f'Refusing to overwrite conflicting archive metadata: {cid}')
        destination.write_bytes(body)
    return report, report_path, len(copied)


def load_staged_report():
    report_path = ROOT / 'public/archive/recovery/danktone-metadata.json'
    report = json.loads(report_path.read_text(encoding='utf-8'))
    if report.get('generatedBy') != 'scripts/merge-danktone-recovery.py':
        raise ValueError('Unexpected staged Danktone report format')
    identities, cids = set(), set()
    for entry in report.get('records', []):
        key = (entry.get('contractAddress', '').lower(), str(entry.get('tokenId')))
        cid = entry.get('cid')
        if key in identities or cid in cids:
            raise ValueError(f'Duplicate staged identity or CID: {key} {cid}')
        identities.add(key)
        cids.add(cid)
        if entry.get('externalUrlMatchesManifestIdentity') is not True:
            raise ValueError(f'External metadata identity mismatch: {cid}')
        if entry.get('identityStatus') not in {'reported', 'verified'}:
            raise ValueError(f'Unexpected identity status: {cid}')
        raw, metadata, digest = read_verified(ROOT / 'public/archive/metadata' / f'{cid}.json',
                                              cid, entry['verification'].get('sha256'),
                                              entry['verification'].get('bytes'))
        if metadata.get('external_url') != entry.get('externalUrl'):
            raise ValueError(f'Staged metadata external_url changed: {cid}')
        if metadata.get('name') != entry.get('name'):
            raise ValueError(f'Staged metadata name changed: {cid}')
        if entry.get('identityStatus') == 'verified' and not entry.get('tokenURI'):
            raise ValueError(f'Verified status requires exact tokenURI evidence: {cid}')
    return report


def merge_app(report):
    index_path = ROOT / 'src/data/archive-index.json'
    metadata_path = ROOT / 'src/data/music-blueprint-metadata.json'
    audio_path = ROOT / 'src/data/archive-audio-sources.json'
    projects_path = ROOT / 'src/data/music-blueprint-projects.json'
    profiles_path = ROOT / 'src/data/artist-profiles.json'
    coverage_path = ROOT / 'src/data/blueprint-project-coverage.json'
    index = json.loads(index_path.read_text())
    music_metadata = json.loads(metadata_path.read_text())
    audio = json.loads(audio_path.read_text())
    projects = json.loads(projects_path.read_text())
    profiles = json.loads(profiles_path.read_text())
    coverage = json.loads(coverage_path.read_text())
    records = index['records']
    by_cid = {r['cid']: r for r in records if r.get('cid')}
    by_token = {(r.get('contractAddress', '').lower(), str(r.get('tokenId'))): r
                for r in records if r.get('contractAddress') and r.get('tokenId')}
    profile_by_address = {p['address'].lower(): p for p in profiles.get('profiles', []) if p.get('address')}
    project_rows = {p['id']: p for p in projects.get('projects', [])}
    project_insert_count = 0

    # Remove the earlier overbroad H0m3 project-level count. Contract evidence
    # stays in the recovery report, but only identified token metadata is merged.
    coverage.pop('6299ca161f3e98af7d976a6f', None)

    for project_id, evidence in report.get('coverageEvidence', {}).items():
        if project_id not in TARGETS or project_id == '63ed56a882b726f72c1b3c95':
            raise ValueError(f'Unexpected/unaudited Danktone coverage project: {project_id}')
        if len(evidence.get('mintedTokenIds', [])) != evidence.get('mintedTokenCount'):
            raise ValueError(f'Invalid coverage token ID count for {project_id}')
        coverage[project_id] = {'checkedOn': '2026-11-08',
                                'throughBlock': int(evidence['throughBlock']),
                                'mintedCount': evidence['mintedTokenCount'],
                                'evidenceUrl': '/archive/recovery/danktone-metadata.json',
                                'fromBlock': int(evidence['fromBlock']),
                                'contractAddress': evidence['contractAddress'],
                                'mintLogCount': evidence['mintLogCount']}

    for project in report['projects']:
        existing = project_rows.get(project['id'])
        if existing:
            existing['name'] = project['name']
            existing['evidenceUrl'] = 'https://www.async.art/archive/recovery/danktone-metadata.json'
            existing['basis'] = 'Original Collection/Artist traits and CID-verified metadata from the Danktone recovery.'
        else:
            existing = {'id': project['id'], 'name': project['name'],
                        'evidenceUrl': 'https://www.async.art/archive/recovery/danktone-metadata.json',
                        'basis': 'Original Collection/Artist traits and CID-verified metadata from the Danktone recovery.'}
            projects.setdefault('projects', []).append(existing)
            project_rows[project['id']] = existing
            project_insert_count += 1

    added = 0
    updated = 0
    for entry in report['records']:
        cid, contract, token = entry['cid'], entry['contractAddress'], entry['tokenId']
        existing_cid, existing_token = by_cid.get(cid), by_token.get((contract, token))
        if existing_cid and existing_token and existing_cid is not existing_token:
            raise ValueError(f'CID/token point to separate app records: {cid} and {contract}#{token}')
        existing = existing_cid or existing_token
        if existing and existing.get('cid') not in (None, '', cid):
            raise ValueError(f'Conflicting CID for existing edition {contract}#{token}')
        if existing and existing.get('blueprintId') not in (None, '', entry['projectId']):
            raise ValueError(f'Conflicting project for existing edition {contract}#{token}')
        record = existing if existing else {'id': entry['recordId'], 'link': None, 'coreAddress': ''}
        old_identity = record.get('identityStatus')
        record.update({'name': entry['name'], 'artist': entry['artist'], 'description': entry['description'],
                       # Raw index data remains in the existing generic family;
                       # the catalog registry classifies these projects at runtime.
                       'family': 'blueprints', 'kind': 'Edition', 'tokenId': token,
                       'contractAddress': contract, 'cid': cid, 'metadataUri': entry['metadataUri'],
                       'source': 'CID-verified Danktone original metadata',
                       'identityStatus': 'verified' if entry['identityStatus'] == 'verified' else (old_identity or 'reported'),
                       'metadataVerified': True, 'metadataLocal': True, 'blueprintId': entry['projectId'],
                       'collection': entry['collection'], 'image': entry.get('image'),
                       'imageSource': 'Original metadata', 'metadataSha256': entry['verification']['sha256'],
                       'metadataBytes': entry['verification']['bytes'],
                       'externalUrl': entry.get('externalUrl'),
                       'externalUrlMatchesManifestIdentity': entry.get('externalUrlMatchesManifestIdentity', False)})
        if entry.get('animationUrl'):
            record['animationUrl'] = entry['animationUrl']
        record['metadataVerification'] = entry['verification']
        record['identityEvidence'] = entry.get('tokenURI') or entry.get('externalUrl')
        if not existing:
            records.append(record)
            added += 1
        else:
            updated += 1
        by_cid[cid] = record
        by_token[(contract, token)] = record

        metadata_row = {'name': entry['name'], 'artist': entry['artist'],
                        'collection': entry['collection'], 'image': entry.get('image'),
                        'description': entry['description'], 'metadataVerified': True,
                        'metadataLocal': True, 'family': 'music-blueprints',
                        'metadataSha256': entry['verification']['sha256'],
                        'identityStatus': entry['identityStatus']}
        if entry.get('animationUrl'):
            metadata_row['animationUrl'] = entry['animationUrl']
        music_metadata[cid] = {**music_metadata.get(cid, {}), **metadata_row}

        audio_cid = media_cid(entry.get('animationUrl'))
        if audio_cid:
            row = {'metadata': f'ipfs://{cid}', 'family': 'music-blueprints'}
            current = audio.get(audio_cid)
            if current is None:
                audio[audio_cid] = [row]
            elif row not in current:
                current.append(row)

        for signature in entry.get('signatures', []):
            address = str(signature.get('address') or '').lower()
            profile = profile_by_address.get(address)
            if not profile:
                continue
            works = profile.setdefault('works', [])
            if not any(work.get('recordId') == record['id'] for work in works):
                works.append({'recordId': record['id'], 'basis': 'metadata-signature'})

    index['generatedOn'] = '2026-11-08'
    index['counts'] = dict(Counter(r['family'] for r in records))
    projects['reviewedOn'] = '2026-11-08'
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    metadata_path.write_text(json.dumps(music_metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    audio_path.write_text(json.dumps(audio, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    projects_path.write_text(json.dumps(projects, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    profiles_path.write_text(json.dumps(profiles, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    coverage_path.write_text(json.dumps(coverage, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return {'addedRecords': added, 'updatedRecords': updated,
            'projectRowsAdded': project_insert_count, 'archiveRecords': len(records)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--stage-only', action='store_true', help='write verified recovery JSON and raw metadata files only')
    mode.add_argument('--apply', action='store_true', help='merge the staged report and verified metadata into app catalogs')
    args = parser.parse_args()
    if args.stage_only:
        report, path, files = stage()
        result = {'report': str(path), 'metadataFiles': files, 'records': len(report['records'])}
    else:
        report = load_staged_report()
        result = {'report': str(ROOT / 'public/archive/recovery/danktone-metadata.json'),
                  'metadataFiles': len({r['cid'] for r in report['records']}),
                  'records': len(report['records'])}
        result.update(merge_app(report))
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
