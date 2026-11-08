import { artistName, type ArtistProfile } from '@/utils/artist-profiles';

export default function ArtistPortrait({
  profile,
  large = false,
}: {
  profile: ArtistProfile;
  large?: boolean;
}) {
  const size = large
    ? 'h-32 w-32 sm:h-40 sm:w-40 text-4xl'
    : 'h-16 w-16 text-xl';
  return profile.portrait ? (
    <img
      src={profile.portrait}
      alt={`${artistName(profile)} — archived profile portrait`}
      width={large ? 160 : 64}
      height={large ? 160 : 64}
      loading={large ? 'eager' : 'lazy'}
      className={`${size} shrink-0 rounded-full object-cover bg-surface-sunken border border-border`}
    />
  ) : (
    <div
      aria-hidden="true"
      className={`${size} shrink-0 rounded-full bg-surface-sunken border border-border flex items-center justify-center text-accent font-semibold`}
    >
      {Array.from(artistName(profile))[0]?.toUpperCase()}
    </div>
  );
}
