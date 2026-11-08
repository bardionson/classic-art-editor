# Dream Recorder restoration

Restored project: `/archive/blueprints/project/637830825aad290ba157149d`.

The original signed project metadata identifies Async Music Blueprints V2,
`0xbc402bed62c90afd0e104be32bdee9447b5ccd0d`. All 3,000 tokenURI calls (3193–6192) at block
26371566 returned `QmTXLb7HkeAxHfWJwpvNiuUXK9Zy5iPv9BPMP7SJuaSZbe/TOKEN/token.json`.
Sample original external_url fields identify project `637830825aad290ba157149d`.

The Guild Archive preserves all 3,000 edition images, media references and traits.
Source: https://theguildarchive.eth.limo/projects/dreamrecorder/viewer-data.js. Original source SHA-256 and chain evidence are in
`public/archive/recovery/dream-recorder.json`.

410 exact original metadata files were additionally recovered and CID-verified.
They match the Guild data. Public gateway throttling prevented the remainder of the
individual metadata downloads; those entries are explicitly not marked CID-verified.
No original metadata was fabricated. The imported Guild fields are stored separately
from original files in `src/data/dream-recorder.json`.

2,995 entries reference IPFS audio and use the existing R2-first streaming endpoint.
R2 import remains on-demand; this change does not bulk-cache 3,000 audio/image files.
Five legendary entries point to old Cloudinary MP4 URLs returning 404. Their
artwork/traits remain browsable, with the unavailable video stated explicitly.
Recover these originals rather than substituting a different edition's soundtrack.

The V2 contract also has Music Worm (token 0) and existing inventory from nine
additional project IDs. Name and metadata evidence confirm this is a music contract;
the shared classification now includes it. This is not a complete V2 supply audit.

Reproduction: verify chain tokenURIs; validate source data against downloaded metadata;
preserve exact JSON bytes only when their UnixFS CID matches the resolved file CID.
Do not mark all media as fetched or pinned: recovery here preserves references.
