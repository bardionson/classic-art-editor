import v1Abi from '@/abis/v1Abi';
import v2Abi from '@/abis/v2Abi';
import { Modal, ModalSkeleton } from '@/components/common/modal';
import { V1_CONTRACT_ADDRESS, V2_CONTRACT_ADDRESS, __PROD__ } from '@/config';
import { getErrorMessage } from '@/utils/common';
import { getCustomIPFSGateway, setCustomIPFSGateway } from '@/utils/ipfs';
import { FormEvent, useEffect, useState } from 'react';
import { X } from 'react-feather';
import { Address, createPublicClient, getContract, http } from 'viem';
import { mainnet, goerli } from 'wagmi/chains';
import ArtworkViewer from '../artwork/artwork-viewer';
import { useSearchParams } from 'next/navigation';

const publicClient = createPublicClient({
  chain: __PROD__ ? mainnet : goerli,
  transport: http(),
});

type MasterArtInfo = {
  tokenAddress: Address;
  tokenId: number;
};

export default function MasterArtViewer({
  onClose,
  tokenAddress: initialTokenAddress,
  tokenId: initialTokenId,
}: {
  onClose: VoidFunction;
  tokenAddress?: Address;
  tokenId?: number;
}) {
  const [artInfo, setArtInfo] = useState<MasterArtInfo | undefined>(
    initialTokenAddress && initialTokenId
      ? { tokenAddress: initialTokenAddress, tokenId: initialTokenId }
      : undefined,
  );

  if (!artInfo)
    return (
      <Modal title="View Master Artwork" onClose={onClose}>
        <FormScreen onSubmit={setArtInfo} />
      </Modal>
    );

  return (
    <ModalSkeleton className="overflow-auto !px-0" onClose={onClose}>
      <div className="fixed top-0 right-0 z-20 w-full flex justify-between p-6 md:p-8">
        <button onClick={onClose} aria-label="Close" className="ml-auto -mr-1">
          <X size={36} className="text-white" />
        </button>
      </div>
      <ArtworkViewer
        tokenAddress={artInfo.tokenAddress}
        tokenId={artInfo.tokenId}
      />
    </ModalSkeleton>
  );
}

type FormScreenProps = {
  onSubmit: (artInfo: MasterArtInfo) => void;
};

function FormScreen({ onSubmit }: FormScreenProps) {
  const [state, setState] = useState<
    'default' | 'loading' | 'token404' | 'error'
  >('default');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState('loading');

    // @ts-ignore
    const tokenId = Number(e.target.tokenId.value);
    // @ts-ignore
    const tokenAddress = e.target.tokenAddress.value as Address;
    // @ts-ignore
    setCustomIPFSGateway(e.target.ipfsGatewayURL.value);

    const contract = getContract({
      address: tokenAddress,
      abi: tokenAddress === V1_CONTRACT_ADDRESS ? v1Abi : v2Abi,
      client: publicClient,
    });

    try {
      const tokenURI = await contract.read.tokenURI([BigInt(tokenId)]);
      // V1 contract won't fail for non existent token, it will just return an empty string.
      if (!tokenURI) throw new Error('URI query for nonexistent token');

      // controlTokens exist for layers, this means it's layer token
      const controlTokens = await contract.read
        .getControlToken([BigInt(tokenId)])
        .catch(() => null);

      if (controlTokens) throw new Error('URI query for nonexistent token');
      onSubmit({ tokenAddress, tokenId });
    } catch (error) {
      const message = getErrorMessage(error);
      const is404 = message.includes('URI query for nonexistent token');
      setState(is404 ? 'token404' : 'error');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="tokenAddress" className="text-sm font-bold">
          Token Address
        </label>
        <select
          required
          className="mt-1"
          name="tokenAddress"
          defaultValue={V2_CONTRACT_ADDRESS}
        >
          {V1_CONTRACT_ADDRESS && (
            <option value={V1_CONTRACT_ADDRESS}>V1 Artwork</option>
          )}
          <option value={V2_CONTRACT_ADDRESS}>V2 Artwork</option>
        </select>
      </div>
      <div className="mt-2">
        <label htmlFor="tokenId" className="text-sm font-bold">
          Master Token ID
        </label>
        <input
          type="number"
          min={0}
          step={1}
          required
          id="tokenId"
          name="tokenId"
          className="mt-1"
          placeholder="516"
        />
      </div>
      <div className="mt-2">
        <label htmlFor="ipfsGatewayURL" className="text-sm font-bold">
          IPFS Gateway (Optional)
        </label>
        <input
          type="url"
          id="ipfsGatewayURL"
          name="ipfsGatewayURL"
          className="mt-1"
          placeholder="https://ipfs.io"
          defaultValue={getCustomIPFSGateway()}
        />
      </div>
      <button
        disabled={state === 'loading'}
        className="btn btn-black w-full mt-4"
      >
        Render Artwork
      </button>
      {(state === 'token404' || state === 'error') && (
        <p className="text-red text-sm text-center mt-3">
          {state === 'token404'
            ? 'Invalid master token id provided.'
            : 'Unexpected error occured. Please try again.'}
        </p>
      )}
    </form>
  );
}
