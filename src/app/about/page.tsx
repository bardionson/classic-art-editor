import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About this restoration | Digital Rescue Lab',
  description:
    'The Async Art archive is independently restored by Digital Rescue Lab, a separate organization from the original Async company.',
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-8 py-10 sm:py-16">
      <Link href="/" className="text-sm text-accent underline">
        Back to the archive
      </Link>
      <h1 className="mt-6 mb-6 text-3xl sm:text-4xl font-bold">
        About this restoration
      </h1>
      <p className="text-xl font-semibold mb-5">
        Independently restored by Digital Rescue Lab
      </p>
      <div className="space-y-5 text-base leading-relaxed text-text-muted">
        <p>
          This site is an independent archive restoration operated by Digital
          Rescue Lab. We are a separate organization from Asynchronous Art,
          Inc., the company behind the original Async platform.
        </p>
        <p>
          We recover and preserve existing artworks, music, metadata, and
          interactive behavior so people can experience these works again.
          Restoration is ongoing; individual works may have missing media or
          features that still need recovery.
        </p>
        <p>
          The Async name, historical branding, artist credits, and original
          token references identify the platform and works being preserved.
          Their appearance here does not imply endorsement of this restoration
          by the original company or every featured artist.
        </p>
        <p>
          Artists and other rights holders retain their applicable rights.
          Recovered files and working playback do not, by themselves, grant
          permission to commercially reuse an artwork.
        </p>
        <p>
          Contributions through this site support Digital Rescue Lab’s
          restoration work, hosting, and asset preservation. They are not
          payments to the original Async company.
        </p>
      </div>
      <div className="mt-8 flex flex-wrap gap-4">
        <a
          href="https://digitalrescuelab.xyz/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-accent px-5 py-3 font-semibold text-white"
        >
          Visit Digital Rescue Lab ↗
        </a>
        <Link
          href="/#collections"
          className="rounded-lg border border-border px-5 py-3 font-semibold text-text"
        >
          Explore the archive
        </Link>
      </div>
    </main>
  );
}
