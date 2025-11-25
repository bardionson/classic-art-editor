'use client';

import dynamic from 'next/dynamic';

const Providers = dynamic(() => import('./providers'), {
  ssr: false,
  loading: () => <p>Loading...</p>,
});

export default function App({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
