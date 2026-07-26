'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import WalletProvider from '@/app/wallet-provider';
import Gallery from '@/components/gallery/Gallery';
import Spinner from '@/components/common/spinner';
import { useOwnedAsyncNfts } from '@/hooks/useOwnedAsyncNfts';

export default function WalletPage() {
  const { isConnected, isLoading, error, ownedMasters, ownedLayers } =
    useOwnedAsyncNfts();

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center gap-6 text-center">
        <p className="text-lg text-text-muted">
          Connect your wallet to view your Async collection.
        </p>
        <WalletProvider>
          <ConnectButton accountStatus="address" showBalance={false} />
        </WalletProvider>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center gap-4 text-center">
        <Spinner size={32} className="text-accent" />
        <p className="text-text-muted">Loading your Async collection...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-text-muted">
          Something went wrong while loading your collection: {error}
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Async Wallet</h1>

      <div className="mb-12">
        {ownedMasters.length > 0 ? (
          <Gallery title="Your Masters" items={ownedMasters} embedded />
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-4">Your Masters</h2>
            <p className="text-text-muted">
              You don&apos;t own any Async Masters yet.
            </p>
          </>
        )}
      </div>

      <div>
        {ownedLayers.length > 0 ? (
          <Gallery title="Your Layers" items={ownedLayers} embedded />
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-4">Your Layers</h2>
            <p className="text-text-muted">
              You don&apos;t own any Async Layers yet.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
