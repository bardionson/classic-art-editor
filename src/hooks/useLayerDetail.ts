import { Address, getContract } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { getStaticLayerData } from '@/utils/layers';
import { getAbiForAddress, getTokenOwner } from '@/utils/contract-helpers';
import { fetchIpfs } from '@/utils/ipfs';
import { normalizeImageUrl } from '@/utils/masters';

export interface LayerDetail {
  tokenId: string;
  contractAddress: string;
  name: string;
  description: string | null;
  imageUrl: string;
  artistName?: string;
  masterTokenId: string;
  attributes?: { trait_type?: string; value?: unknown }[];
  owner?: Address;
}

async function fetchLayerDetail(
  contractAddress: Address,
  tokenId: string,
): Promise<LayerDetail> {
  const staticData = getStaticLayerData(contractAddress, tokenId);
  const { publicClient } = await import('@/utils/rpcClient');

  let ipfsMetadata: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: { trait_type?: string; value?: unknown }[];
  } | null = null;

  try {
    const contract = getContract({
      address: contractAddress,
      abi: getAbiForAddress(contractAddress),
      client: publicClient,
    });
    const tokenURI = await contract.read.tokenURI([BigInt(tokenId)]);
    if (tokenURI) {
      try {
        const response = await fetchIpfs(tokenURI);
        ipfsMetadata = await response.json();
      } catch (e) {
        console.error(
          `Failed to fetch IPFS metadata for layer ${contractAddress}-${tokenId}`,
          e,
        );
      }
    }
  } catch (e) {
    console.error(
      `Failed to read tokenURI for layer ${contractAddress}-${tokenId}`,
      e,
    );
  }

  let owner: Address | undefined;
  try {
    owner = await getTokenOwner(contractAddress, Number(tokenId), publicClient);
  } catch (e) {
    console.error(
      `Failed to read owner for layer ${contractAddress}-${tokenId}`,
      e,
    );
  }

  if (!staticData && !ipfsMetadata && !owner) {
    throw new Error('Unable to load layer details from any source.');
  }

  return {
    tokenId,
    contractAddress,
    name: ipfsMetadata?.name || staticData?.name || `Layer #${tokenId}`,
    description: ipfsMetadata?.description ?? staticData?.description ?? null,
    imageUrl: ipfsMetadata?.image
      ? normalizeImageUrl(ipfsMetadata.image)
      : staticData?.imageUrl || '',
    artistName: staticData?.artistName,
    masterTokenId: staticData?.masterTokenId || '',
    attributes: ipfsMetadata?.attributes,
    owner,
  };
}

// Bounded rather than Infinity: this data (metadata, controls) is close to
// immutable within a session, but the owner specifically CAN change mid-
// session (an external transfer/sale while the tab is open), and Infinity
// would leave no way to ever pick that up short of a full page reload.
// One minute keeps repeat opens across the gallery/master-view/wallet entry
// points feeling instant (satisfying "don't reload from IPFS every time")
// while still letting the owner refresh on a reasonably normal cadence.
const LAYER_DETAIL_STALE_TIME_MS = 60_000;

export function useLayerDetail(
  contractAddress: Address | undefined,
  tokenId: string | undefined,
) {
  return useQuery({
    queryKey: ['layerDetail', contractAddress?.toLowerCase(), tokenId],
    queryFn: () =>
      fetchLayerDetail(contractAddress as Address, tokenId as string),
    enabled: Boolean(contractAddress && tokenId),
    staleTime: LAYER_DETAIL_STALE_TIME_MS,
  });
}
