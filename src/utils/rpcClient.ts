import { createPublicClient, http } from 'viem';
import { mainnet, goerli } from 'wagmi/chains';
import { __PROD__ } from '@/config';

const transport = http('/api/rpc');

export const publicClient = createPublicClient({
  chain: __PROD__ ? mainnet : goerli,
  transport,
});
