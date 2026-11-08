import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sources from '@/data/archive-audio-sources.json';
import {
  dreamRecorder,
  dreamEditions,
  dreamRecorderRecords,
  dreamMetadataUri,
  dreamEditionHref,
  dreamMediaUri,
} from './dream-recorder';
import { searchArchive, getArchiveRecordByCid } from './archive-search';
import { getBlueprintProject } from './blueprint-projects';
import { metadataPlayback } from './archive-media';

describe('Dream Recorder recovery', () => {
  it('preserves all 3000 token identities on the original V2 music contract', () => {
    expect(Object.keys(dreamEditions)).toEqual(
      Array.from({ length: 3000 }, (_, i) => String(i + 3193)),
    );
    expect(dreamRecorder.contractAddress).toBe(
      '0xbc402bed62c90afd0e104be32bdee9447b5ccd0d',
    );
    expect(getBlueprintProject(dreamRecorder.projectId)?.count).toBe(3000);
    expect(
      searchArchive(`${dreamRecorder.contractAddress}:3193`).results[0]?.name,
    ).toBe('Dream #0');
    expect(
      searchArchive('0x71925638b9998ab631c83873d9ed19ef9b70ecf0:3193').total,
    ).toBe(0);
    expect(
      searchArchive(`${dreamRecorder.contractAddress}:6192`).results[0]?.link,
    ).toBe(dreamEditionHref('6192'));
  });
  it('searches musician and legendary editions without mixing projects or pagination', () => {
    for (const [query, total] of [
      ['plutonic mind', 1006],
      ['Johnny Filter', 1012],
      ['Marcotic', 977],
      ['Legendary Edition', 5],
    ] as const) {
      expect(
        searchArchive(
          query,
          'music-blueprints',
          1,
          'all',
          dreamRecorder.projectId,
        ).total,
      ).toBe(total);
    }
    const first = searchArchive(
      '',
      'music-blueprints',
      1,
      'all',
      dreamRecorder.projectId,
    );
    const second = searchArchive(
      '',
      'music-blueprints',
      2,
      'all',
      dreamRecorder.projectId,
    );
    expect(first.total).toBe(3000);
    expect(first.results).toHaveLength(24);
    expect(
      second.results.every(
        (r) =>
          r.blueprintId === dreamRecorder.projectId &&
          !first.results.some((f) => f.id === r.id),
      ),
    ).toBe(true);
  });
  it('retains exact original metadata bytes and only marks those copies verified', () => {
    const report = JSON.parse(
      readFileSync('public/archive/recovery/dream-recorder.json', 'utf8'),
    );
    expect(report.tokenURIs).toHaveLength(3000);
    for (const e of report.tokenURIs)
      expect(e.tokenURI).toBe(dreamMetadataUri(e.tokenId));
    expect(report.cidVerifiedMetadata).toHaveLength(410);
    expect(dreamRecorderRecords.filter((r) => r.metadataVerified)).toHaveLength(
      410,
    );
    for (const e of report.cidVerifiedMetadata) {
      const bytes = readFileSync(`public/archive/metadata/${e.cid}.json`);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(e.sha256);
      const raw = JSON.parse(bytes.toString());
      const edition = dreamEditions[e.tokenId];
      expect(raw.name).toBe(edition.name);
      expect(raw.image).toBe(dreamMediaUri(edition.image));
      expect(raw.animation_url).toBe(dreamMediaUri(edition.animation));
      expect(raw.attributes).toEqual(edition.attributes);
      expect(getArchiveRecordByCid(e.cid)?.link).toBe(
        dreamEditionHref(e.tokenId),
      );
    }
    expect(dreamEditions['3193'].cid).toBe(
      'QmRQBRtuJUMFH7V18SFEBjMLGrXJekwsczHWiiJWrMt2az',
    );
    expect(
      dreamRecorderRecords
        .filter((r) => !r.cid)
        .every((r) => !r.metadataVerified && !r.metadataLocal),
    ).toBe(true);
  });
  it('allows the 2995 original audio references while retaining the five unavailable videos', () => {
    const audio = Object.values(dreamEditions).filter((e) =>
      e.animation.startsWith('Qm'),
    );
    expect(audio).toHaveLength(2995);
    for (const e of audio) {
      expect(sources).toHaveProperty(e.animation);
      expect(
        metadataPlayback({ audio: dreamMediaUri(e.animation) })?.kind,
      ).toBe('audio');
    }
    const video = dreamRecorderRecords.filter(
      (r) => r.kind === 'Legendary Edition',
    );
    expect(video.map((r) => r.tokenId)).toEqual([
      '3586',
      '3886',
      '4077',
      '4243',
      '5106',
    ]);
    expect(
      video.every((r) =>
        r.animationUrl?.startsWith(
          'https://asynchronous-art-inc-res.cloudinary.com/',
        ),
      ),
    ).toBe(true);
  });
});
