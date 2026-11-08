import Link from 'next/link';
import ArtistName from '@/components/artist-name';
import { artistCreditParts } from '@/utils/artist-links';
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
  const addresses = profiles.map((p) => p.address);
  const linked = new Set(
    artistCreditParts(credit, addresses).map((part) => part.href),
  );
  // Preserve source-backed contributor links when a group credit does not name them.
  const additional = profiles.filter((p) => !linked.has(artistHref(p)));
  return (
    <>
      <ArtistName credit={credit} allowedAddresses={addresses} />
      {additional.length > 0 && (
        <span className="mt-1 block text-xs text-accent">
          {additional.map((profile, index) => (
            <span key={profile.address}>
              {index > 0 && ' · '}
              <Link href={artistHref(profile)} className="hover:underline">
                {artistName(profile)} profile
              </Link>
            </span>
          ))}
        </span>
      )}
    </>
  );
}
