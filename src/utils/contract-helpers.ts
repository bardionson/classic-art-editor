import { Address, getContract, PublicClient } from 'viem';
import v1Abi from '@/abis/v1Abi';
import v2Abi from '@/abis/v2Abi';
import { V1_CONTRACT_ADDRESS, V2_CONTRACT_ADDRESS } from '@/config';

export type ResolvedLayerContractResult = {
  contractAddress: Address;
  tokenURI: string;
};

export const getAbiForAddress = (address: Address) => {
  if (address === V1_CONTRACT_ADDRESS) return v1Abi;
  return v2Abi;
};

export const resolveLayerContract = async (
  tokenId: number,
  publicClient: PublicClient
): Promise<ResolvedLayerContractResult | null> => {
  // Try V2 first
  try {
    const v2Contract = getContract({
      address: V2_CONTRACT_ADDRESS as Address,
      abi: v2Abi,
      client: publicClient,
    });

    const tokenURI = await v2Contract.read.tokenURI([BigInt(tokenId)]);
    if (tokenURI) {
      return {
        contractAddress: V2_CONTRACT_ADDRESS as Address,
        tokenURI,
      };
    }
  } catch (e: any) {
    // Ignore error if not found, continue to V1 fallback logic
    // But log unexpected errors? No, just fallback.
  }

  // If token <= 347 and V1 address is available, try V1
  if (tokenId <= 347 && V1_CONTRACT_ADDRESS) {
    try {
      const v1Contract = getContract({
        address: V1_CONTRACT_ADDRESS as Address,
        abi: v1Abi,
        client: publicClient,
      });

      const tokenURI = await v1Contract.read.tokenURI([BigInt(tokenId)]);
      if (tokenURI) {
        return {
          contractAddress: V1_CONTRACT_ADDRESS as Address,
          tokenURI,
        };
      }
    } catch (e) {
      // Ignore error
    }
  }

  return null;
};
