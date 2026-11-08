import { permanentRedirect } from 'next/navigation';

// Preserve the category used by original Async announcements and bookmarks.
export default function LegacyBlueprintsPage({
  searchParams,
}: {
  searchParams: { category?: string | string[] };
}) {
  permanentRedirect(
    searchParams.category === 'music'
      ? '/archive/music-blueprints'
      : '/archive/blueprints',
  );
}
