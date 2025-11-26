'use client';

import { __PROD__ } from '@/config';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { WagmiProvider } from 'wagmi';
import { goerli, mainnet } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const projectId = __PROD__
  ? 'fe5ade2ca72bf579c0f012ed91b1ddc4'
  : '515550cbf8f0d8aa47b342421d167450';

const config = getDefaultConfig({
  appName: 'Async Classic Art Editor',
  projectId,
  chains: [__PROD__ ? mainnet : goerli],
});

const queryClient = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
