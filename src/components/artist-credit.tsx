import Link from 'next/link';
import {
  artistHref,
  artistName,
  artistsForRecord,
} from '@/utils/artist-profiles';

export default function ArtistCredit({
  recordId,
  credit,
}: {
  recordId: string;
  credit: string;
}) {
  const profiles = artistsForRecord(recordId);
  if (!profiles.length) return <>{credit}</>;
  // Preserve the complete original collaboration credit, even when only one
  // collaborator's historical identity has been recovered.
  return (
    <>
      {credit}
      <span className="block mt-1 text-xs">
        {profiles.map((p, index) => (
          <span key={p.address}>
            {index > 0 && ' · '}
            <Link href={artistHref(p)} className="text-accent underline">
              {artistName(p)} profile
            </Link>
          </span>
        ))}
      </span>
    </>
  );
}
