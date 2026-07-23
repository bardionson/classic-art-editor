import { Address } from 'viem';

export type MirrorRole = 'display' | 'control';

export type MirrorSession = {
  tokenAddress: Address;
  tokenId: number;
  controlOverrides: Record<string, number>;
  displayLastSeenAt: number;
  controlLastSeenAt: number | null;
};
