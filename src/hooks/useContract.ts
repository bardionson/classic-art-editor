import v1Abi from '@/abis/v1Abi';
import v2Abi from '@/abis/v2Abi';
import { V1_CONTRACT_ADDRESS } from '@/config';
import { useMemo } from 'react';
import { isAddress, getContract, Address } from 'viem';
import { useWalletClient } from 'wagmi';

export default function useContract(address: Address) {
  const { data: walletClient } = useWalletClient();
  const abi = address === V1_CONTRACT_ADDRESS ? v1Abi : v2Abi;

  return useMemo(
    () =>
      isAddress(address) && !!abi && !!walletClient
        ? getContract({ address, abi, client: walletClient })
        : undefined,
    [address, abi, walletClient],
  );
}
