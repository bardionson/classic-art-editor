import core from '@/data/forever-supper.json';
import { getArchiveRecords, type ArchiveRecord } from './archive-search';
import { getExpansionMedia } from './dynamic-expansion-media';

export const supperCore = core;
const items = getArchiveRecords().filter(
  (r) =>
    r.family === 'dynamic-blueprints' &&
    r.coreAddress?.toLowerCase() === core.contract,
);
const normalized = (s: string) =>
  s.normalize('NFKD').replace(new RegExp('\\p{M}', 'gu'), '').toLowerCase();
export function supperItems(slot = '', query = ''): ArchiveRecord[] {
  const terms = normalized(query).trim().split(/\s+/).filter(Boolean);
  return items
    .filter(
      (r) =>
        (!slot ||
          getExpansionMedia(r.cid)?.layers.some(
            (l) => l.slot === slot && l.type === 'Type 1',
          )) &&
        terms.every((t) =>
          normalized(`${r.name} ${r.artist} ${r.slot ?? ''}`).includes(t),
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name) || a.cid.localeCompare(b.cid));
}
// Recreate the original renderer's replacement semantics. Never use trimmed
// gallery thumbnails here: sources retain their full original canvas.
export function composeSupper(cids: string[]) {
  const replacements = new Map<string, { source: string; label: string }>();
  for (const cid of Array.from(new Set(cids))) {
    if (!items.some((r) => r.cid === cid))
      throw new Error('Item belongs to another core or is unknown');
    const media = getExpansionMedia(cid);
    if (!media?.layers.length) throw new Error('Item layout is unavailable');
    for (const layer of media.layers) {
      if (
        layer.type !== 'Type 1' ||
        !core.slots.some((s) => s.id === layer.slot)
      )
        throw new Error('Unsupported type or slot');
      if (replacements.has(layer.slot))
        throw new Error('Conflicting items in the same slot');
      replacements.set(layer.slot, {
        source: layer.source,
        label: layer.label,
      });
    }
  }
  return core.slots.map((slot) => ({ ...slot, ...replacements.get(slot.id) }));
}
