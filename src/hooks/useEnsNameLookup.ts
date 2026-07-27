import { Address } from 'viem';
import { useQuery } from '@tanstack/react-query';

const ENS_STALE_TIME_MS = 5 * 60_000;

async function fetchEnsName(address: Address): Promise<string | null> {
  const response = await fetch(`/api/ens?address=${address}`);
  if (!response.ok) return null;
  const data = await response.json();
  return data.ensName ?? null;
}

/**
 * Resolves an address's ENS name (mainnet only, regardless of the app's
 * active network) via a server-side proxy that keeps ALCHEMY_KEY hidden.
 * Returns `undefined` while loading, `null` once resolved with no ENS name
 * found (the common case - most addresses don't have one).
 */
export function useEnsNameLookup(address: Address | undefined) {
  return useQuery({
    queryKey: ['ensName', address?.toLowerCase()],
    queryFn: () => fetchEnsName(address as Address),
    enabled: Boolean(address),
    staleTime: ENS_STALE_TIME_MS,
  });
}
