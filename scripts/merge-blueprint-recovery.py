"""Merge preserved, CID-verified Blueprint mint recoveries after rebuilding inventories.

No network or media downloads. Run after build-archive-index.py and/or
import-artist-profiles.py; existing record identities and other projects survive.
"""
import hashlib, importlib.util, json
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('cid_verifier',ROOT/'scripts/import-supper-zip.py')
verifier=importlib.util.module_from_spec(spec);spec.loader.exec_module(verifier)

def main():
    index_path=ROOT/'src/data/archive-index.json'
    profile_path=ROOT/'src/data/artist-profiles.json'
    index=json.loads(index_path.read_text());profiles=json.loads(profile_path.read_text())
    records=index['records'];by_cid={r['cid']:r for r in records if r.get('cid')}
    by_token={(r['contractAddress'].lower(),r['tokenId']):r for r in records if r.get('tokenId') and r.get('contractAddress')}
    by_artist={p['address'].lower():p for p in profiles['profiles']}
    count=0
    for report_path in sorted((ROOT/'public/archive/recovery').glob('*.json')):
        report=json.loads(report_path.read_text())
        if not report.get('projectId') or 'mintLogs' not in report:continue
        contract=report['contractAddress'];project=report['projectId']
        assert len(report['records'])==report['mintedCount']
        for entry in report['records']:
            cid=entry['cid'];token=entry['tokenId']
            raw=(ROOT/'public/archive/metadata'/f'{cid}.json').read_bytes()
            assert verifier.verify(cid,raw) and hashlib.sha256(raw).hexdigest()==entry['sha256']
            meta=json.loads(raw);attrs={a['trait_type']:a['value'] for a in meta['attributes']}
            assert meta['external_url']==f'https://async.market/blueprints/{project}/editions/{contract}-{token}'
            existing=by_cid.get(cid) or by_token.get((contract,token))
            if existing:
                assert existing['cid']==cid,'Conflicting metadata for an existing token'
                assert existing.get('blueprintId') in (None,'',project),'Conflicting project'
            record=existing if existing is not None else {'id':'cid:'+cid,'link':None,'coreAddress':''}
            record.update({'name':meta['name'],'artist':attrs['Artist'],'description':meta.get('description',''),
                'family':'blueprints','kind':'Edition','tokenId':token,'contractAddress':contract,'cid':cid,
                'source':'Ethereum mint events and CID-verified original IPFS metadata','identityStatus':'verified',
                'metadataVerified':True,'metadataLocal':True,'blueprintId':project,'collection':attrs['Collection'],
                'image':meta['image'],'imageSource':'Original metadata'})
            if meta.get('animation_url'):record['animationUrl']=meta['animation_url']
            record['metadataUri']=entry.get('tokenURI','ipfs://'+cid)
            if existing is None:records.append(record)
            by_cid[cid]=record;by_token[(contract,token)]=record
            for signature in meta.get('async-attributes',{}).get('signatures',[]):
                profile=by_artist.get(signature.get('address','').lower())
                if profile and not any(w['recordId']==record['id'] for w in profile['works']):
                    profile['works'].append({'recordId':record['id'],'basis':'metadata-signature'})
            count+=1
    assert len({r['id'] for r in records})==len(records)
    index['generatedOn']='2026-11-08'
    index['counts']=dict(Counter(r['family'] for r in records))
    index_path.write_text(json.dumps(index,ensure_ascii=False,indent=2)+'\n')
    profile_path.write_text(json.dumps(profiles,ensure_ascii=False,indent=2)+'\n')
    print(f'Merged {count} recovered Blueprint editions and artist links')

if __name__=='__main__':main()
