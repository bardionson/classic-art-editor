'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import logo from '../../public/logo/async-logo.svg';

// Static, dependency-free shell shown before Providers (and therefore React
// context/hooks like useArtwork) exist. Must not use hooks or any dynamic
// state — it renders ahead of any provider tree. Visually mirrors
// ArtworkLoader (Stage 4) at a coarse level (art-bed background, wordmark,
// progress bar) but carries no status text or layer count, since none of
// that data exists yet at this point in the app's lifecycle.
function StaticLoadingShell() {
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-art-bed">
      <div className="flex flex-col items-center gap-4 px-4">
        <Image
          src={logo.src}
          width={logo.width}
          height={logo.height}
          alt="Async Art Logo"
          className="h-5 w-auto invert animate-pulse"
        />
        <div className="h-0.5 w-48 bg-surface-sunken/40 rounded-full artwork-loader-progress-track" />
      </div>
    </div>
  );
}

const Providers = dynamic(() => import('./providers'), {
  ssr: false,
  loading: () => <StaticLoadingShell />,
});

export default function App({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
