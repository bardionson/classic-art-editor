import type { Metadata } from 'next';
import ArchiveNavigation from '@/components/archive-navigation';
import ArtworkPriceChecker from '@/components/artwork-price-checker';
export const metadata: Metadata = {
  title: 'Price-driven art checks | Async Art',
  description:
    'Independent ETH and BTC price checks for restoring Async’s changing artworks.',
};
export default function PriceCheckPage() {
  return (
    <main className="container mx-auto max-w-5xl px-4 py-10 sm:py-16">
      <ArchiveNavigation />
      <p className="text-accent text-xs font-semibold uppercase tracking-widest mb-4">
        Restoration in progress
      </p>
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
        Price-driven art checks
      </h1>
      <p className="mt-5 text-lg text-text-muted max-w-3xl">
        Follow the ETH and Bitcoin movements that influence the art. This
        independent checker calculates changes from Async’s recovered rules
        without changing the original tokens.
      </p>
      <ArtworkPriceChecker />
    </main>
  );
}
