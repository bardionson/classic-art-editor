import { notFound, permanentRedirect } from 'next/navigation';
import { artistHref, getArtistProfile } from '@/utils/artist-profiles';

export default async function LegacyArtistProfile(props: {
  params: Promise<{ username: string; section?: string[] }>;
}) {
  const params = await props.params;
  if (
    params.section &&
    (params.section.length !== 1 ||
      !['collection', 'creations'].includes(params.section[0]))
  )
    notFound();
  const profile = getArtistProfile(params.username);
  if (!profile) notFound();
  permanentRedirect(artistHref(profile));
}
