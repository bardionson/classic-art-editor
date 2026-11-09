import { permanentRedirect } from 'next/navigation';

// Preserve the category used by original Async announcements and bookmarks.
export default async function LegacyBlueprintsPage(props: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const searchParams = await props.searchParams;
  permanentRedirect(
    searchParams.category === 'music'
      ? '/archive/music-blueprints'
      : '/archive/blueprints',
  );
}
