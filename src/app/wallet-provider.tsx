'use client';

import { RainbowKitProvider } from '@rainbow-me/rainbowkit';

export default function WalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RainbowKitProvider>{children}</RainbowKitProvider>;
}
