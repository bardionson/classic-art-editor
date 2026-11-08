"""Export allowlisted historical creator profiles and attributed archive records.

Usage: python import-artist-profiles.py RECOVERY_DIRECTORY APP_REPOSITORY
No network; source profiles must be the sanitized recovery export.
"""
import collections
import hashlib
import json
import pathlib
import shutil
import sys
import unicodedata

source, repo = map(pathlib.Path, sys.argv[1:3])
load = lambda path: json.loads(path.read_text(encoding='utf-8'))
def normalize(value):
    # A subset of catalog credits decoded UTF-8 bytes as Latin-1 (BÃ¥rd).
    # Repair only a reversible encoding error; retain original display credits.
    if any(marker in value for marker in ('Ã', 'Â', 'â')):
        try:
            value = value.encode('latin-1').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    return unicodedata.normalize('NFKC', value).strip().casefold()
all_profiles = load(source / 'profiles.json')['profiles']
creators = set(load(source / 'artist-profile-candidates.json')['creatorIdentities'])
# Reviewed historical credits can recover profiles whose archived collection
# page omitted creation counts. Validate the exact source identity and original
# metadata credit; never promote a profile using a fuzzy name match.
reviewed = {}
review_path = repo / 'src/data/reviewed-artist-creators.json'
if review_path.exists():
    for review in load(review_path)['creators']:
        row = next(p for p in all_profiles if p['identity'] == review['identity'])
        assert row['source']['waybackUrl'] == review['profileSourceUrl']
        assert row['profile']['name'] == review['name']
        raw = (repo / 'public/archive/metadata' / (review['metadataCid'] + '.json')).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == review['metadataSha256']
        assert any(a.get('trait_type') == 'Artist' and a.get('value') == review['name']
                   for a in json.loads(raw).get('attributes', []))
        identities = {p['identity'] for p in all_profiles
                      if normalize(p['profile'].get('name', '')) == normalize(review['name'])}
        assert identities == {review['identity']}
        reviewed[review['identity']] = review
        creators.add(review['identity'])
records = load(repo / 'src/data/archive-index.json')['records']
masters = {(r['contractAddress'].lower(), r['cid']): r for r in records if r['kind'] == 'Master' and r['cid']}
layer_masters = {}
for layers in load(repo / 'src/layers.json').values():
    for layer in layers:
        contract = layer['contractAddress'].lower()
        master = masters.get((contract, layer.get('masterTokenId', '')))
        if master:
            layer_masters[f"{contract}:{layer['tokenId']}"] = master['id']
names = collections.defaultdict(set)
for row in all_profiles:
    # Check ambiguity against collectors as well as creators. Never split a
    # collaboration credit, strip accents, or infer identity from a substring.
    for capture in row['captures']:
        for key in ('name', 'username'):
            value = capture['profile'].get(key, '')
            if value.strip():
                names[normalize(value)].add(row['profile']['address'].lower())

wallet_cids = collections.defaultdict(set)
for path in (repo / 'public/archive/metadata').glob('*.json'):
    data = load(path)
    extra = data.get('async-attributes', {})
    if not isinstance(extra, dict):
        continue
    for address in extra.get('artists', []):
        if isinstance(address, str):
            wallet_cids[address.lower()].add(path.stem)

portraits = repo / 'public/archive/artists'
portraits.mkdir(parents=True, exist_ok=True)
result = []
for row in all_profiles:
    if row['identity'] not in creators:
        continue
    profile = row['profile']
    address = profile['address'].lower()
    exported = {key: profile.get(key, '') for key in ('address', 'name', 'username', 'bio', 'website', 'twitter', 'instagram')}
    exported['address'] = address
    exported['aliases'] = row['aliases']
    exported['classification'] = 'historical-creator' if row['identity'] in reviewed else row['classification']
    exported['captureTimestamp'] = row['source']['captureTimestamp']
    exported['sourceUrl'] = row['source']['waybackUrl']
    exported['sourceSha256'] = row['source']['htmlSha256']
    exported['portrait'] = ''
    portrait = row.get('portrait', {})
    if portrait.get('status') == 'recovered' and not portrait.get('isDefaultAvatar'):
        display = portrait.get('displayDerivative') or portrait
        original = source / 'portraits' / display['filename']
        assert hashlib.sha256(original.read_bytes()).hexdigest() == display['sha256']
        shutil.copyfile(original, portraits / original.name)
        exported['portrait'] = '/archive/artists/' + original.name
        exported['portraitSourceUrl'] = portrait['sourceUrl']
        exported['portraitCaptureTimestamp'] = portrait['captureTimestamp']
        exported['portraitSha256'] = display['sha256']
    works = []
    for record in records:
        if record['cid'] in wallet_cids[address]:
            basis = 'metadata-wallet'
        elif record['artist'].strip() and names[normalize(record['artist'])] == {address}:
            basis = 'archive-credit'
        else:
            continue
        works.append({'recordId': record['id'], 'basis': basis})
    linked_ids = {w['recordId'] for w in works}
    for work in list(works):
        master_id = layer_masters.get(work['recordId'])
        if master_id and master_id not in linked_ids:
            works.append({'recordId': master_id, 'basis': 'layer-contribution', 'layerRecordId': work['recordId']})
            linked_ids.add(master_id)
    exported['works'] = works
    result.append(exported)
out = {'schemaVersion': 1, 'profiles': result}
path = repo / 'src/data/artist-profiles.json'
path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'profiles': len(result), 'portraits': sum(bool(p['portrait']) for p in result), 'profilesWithWorks': sum(bool(p['works']) for p in result), 'associations': sum(len(p['works']) for p in result)}, indent=2))
