import { V1_CONTRACT_ADDRESS, V2_CONTRACT_ADDRESS } from '@/config';
import v1Abi from '@/abis/v1Abi';
import v2Abi from '@/abis/v2Abi';
import { Address } from 'viem';

export function getContractInfo(tokenId: number): { address: Address | null; abi: any } {
  if (tokenId <= 347) {
    return { address: V1_CONTRACT_ADDRESS as Address | null, abi: v1Abi };
  } else {
    return { address: V2_CONTRACT_ADDRESS as Address, abi: v2Abi };
  }
}
