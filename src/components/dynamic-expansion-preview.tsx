import ArchivePreview from '@/components/archive-preview';
import { getExpansionMedia } from '@/utils/dynamic-expansion-media';
import { imageCandidates } from '@/utils/archive-media';

export default function DynamicExpansionPreview({
  name,
  cid,
  image,
  large = false,
}: {
  name: string;
  cid: string;
  image?: string;
  large?: boolean;
}) {
  const media = getExpansionMedia(cid);
  if (!media?.layers.length)
    return <ArchivePreview name={name} cid={cid} image={image} large={large} />;
  // Gallery cards show the first declared layer; details retain every layer if
  // future recovered metadata contains more than one. Never combine core slots.
  const layers = large ? media.layers : media.layers.slice(0, 1);
  const cover = imageCandidates(image)[0];
  return (
    <div>
      {layers.map((layer, index) => (
        <div key={`${layer.source}:${index}`}>
          <ArchivePreview
            name={layer.label || name}
            cid=""
            image={layer.source}
            large={large}
          />
          <p className="text-xs text-text-muted mt-2">
            Expansion layer detail
            {large && layer.slot ? ` · ${layer.slot}` : ''}
            {!large && media.layers.length > 1
              ? ` · +${media.layers.length - 1} more`
              : ''}
          </p>
        </div>
      ))}
      {large && cover && (
        <a
          href={cover}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-accent underline inline-block mt-3"
        >
          Open original cover media ↗
        </a>
      )}
    </div>
  );
}
