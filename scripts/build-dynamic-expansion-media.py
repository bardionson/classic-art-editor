import json,pathlib,hashlib
r=pathlib.Path(__file__).resolve().parents[1]
records=json.loads((r/'src/data/archive-index.json').read_text())['records']
media={}
for row in records:
    if row['family']!='dynamic-blueprints' or not row.get('metadataVerified'):continue
    raw=(r/('public/archive/metadata/'+row['cid']+'.json')).read_bytes()
    original=json.loads(raw)
    layers=[]
    for kind in original.get('async-attributes',{}).get('dbpTypes',[]):
        for layer in kind.get('layers',[]):
            state=layer.get('state',{})
            if state.get('uri'):
                layers.append({'source':'ipfs://'+state['uri'].removeprefix('ipfs://'), 'label':state.get('label',row['name']), 'slot':layer.get('id',''), 'type':kind.get('name','')})
    if layers:
        media[row['cid']]={'layers':layers,'metadataSha256':hashlib.sha256(raw).hexdigest()}
(r/'src/data/dynamic-expansion-media.json').write_text(json.dumps(media,ensure_ascii=False,indent=2)+'\n')
print(len(media),'items;',len(set(x['source'] for v in media.values() for x in v['layers'])),'unique layer assets')
