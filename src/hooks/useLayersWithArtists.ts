import { useEffect, useState } from 'react';
import { Address } from 'viem';
import layersData from '@/layers.json';
import { fetchIpfs } from '@/utils/ipfs';
import { resolveLayerContract } from '@/utils/contract-helpers';

export const useLayersWithArtists = (
  tokenAddress?: Address,
  tokenURI?: string,
) => {
  const [layerArtists, setLayerArtists] = useState<Record<string, string>>({});
  const [layerContracts, setLayerContracts] = useState<Record<string, Address>>(
    {},
  );

  const layers = (
    (tokenAddress && layersData[tokenAddress as keyof typeof layersData]) ||
    []
  )
    .filter((l: any) => {
      if (!tokenURI) return false;
      return tokenURI.includes(l.masterTokenId);
    })
    .map((l: any) => ({
      ...l,
      tokenId: parseInt(l.tokenId, 10),
    }));

  useEffect(() => {
    const fetchLayerArtists = async () => {
      const { publicClient } = await import('@/utils/rpcClient');

      const newLayerArtists: Record<string, string> = {};
      const newLayerContracts: Record<string, Address> = {};

      const promises = layers.map(async (layer) => {
        if (layerArtists[layer.tokenId]) return;

        try {
          let metadataUri = (layer as any).metadataUri;
          let contractAddress: Address | undefined;

          if (!metadataUri) {
            try {
              const result = await resolveLayerContract(
                layer.tokenId,
                publicClient,
              );
              if (result) {
                metadataUri = result.tokenURI;
                contractAddress = result.contractAddress;
              }
            } catch (e) {
              console.error(
                `Failed to fetch tokenURI from contract for layer ${layer.tokenId}`,
                e,
              );
              return;
            }
          }

          if (!metadataUri) return;

          if (contractAddress) {
            newLayerContracts[layer.tokenId] = contractAddress;
          }

          const res = await fetchIpfs(metadataUri);
          const data = await res.json();
          const artistAttr = data.attributes?.find(
            (attr: any) =>
              attr.trait_type === 'Artist' || attr.trait_type === 'Creator',
          );
          if (artistAttr) {
            newLayerArtists[layer.tokenId] = artistAttr.value;
          }
        } catch (err) {
          console.error(
            `Failed to fetch metadata for layer ${layer.tokenId}`,
            err,
          );
        }
      });

      await Promise.all(promises);
      if (Object.keys(newLayerArtists).length > 0) {
        setLayerArtists((prev) => ({ ...prev, ...newLayerArtists }));
      }
      if (Object.keys(newLayerContracts).length > 0) {
        setLayerContracts((prev) => ({ ...prev, ...newLayerContracts }));
      }
    };

    if (layers.length > 0) {
      fetchLayerArtists();
    }
    // Deps are the actual identifying inputs (not the derived `layers` array,
    // which is a new reference every render) so this doesn't re-run on every
    // unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenAddress, tokenURI]);

  return layers.map((layer) => ({
    ...layer,
    artistName: layerArtists[layer.tokenId] || layer.artistName,
    contractAddress: layerContracts[layer.tokenId],
  }));
};
