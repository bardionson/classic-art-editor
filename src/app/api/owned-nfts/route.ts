import { NextRequest, NextResponse } from 'next/server';
import {
  ACTIVE_NETWORK,
  V1_CONTRACT_ADDRESS,
  V2_CONTRACT_ADDRESS,
} from '@/config';

// Ensure this environment variable is set
const ALCHEMY_KEY = process.env.ALCHEMY_KEY;

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const MAX_PAGES = 20;

interface AlchemyOwnedNft {
  tokenId?: string;
  // With `withMetadata=false`, Alchemy's NFT API v3 returns a flat
  // `contractAddress` field on each entry (confirmed against a live
  // response) rather than the nested `contract: { address }` shape shown
  // in some of Alchemy's docs/examples (which apply when metadata is
  // requested). Support both so this keeps working if that ever changes.
  contractAddress?: string;
  contract?: {
    address?: string;
  };
}

interface AlchemyGetNftsForOwnerResponse {
  ownedNfts: AlchemyOwnedNft[];
  pageKey?: string;
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');

  if (!address || !ADDRESS_REGEX.test(address)) {
    return NextResponse.json(
      { error: 'Missing or invalid "address" query parameter' },
      { status: 400 },
    );
  }

  if (!ALCHEMY_KEY) {
    console.error('Missing ALCHEMY_KEY in server environment variables.');
    return NextResponse.json(
      { error: 'Server configuration error: Missing ALCHEMY_KEY' },
      { status: 500 },
    );
  }

  const contractAddresses = [V1_CONTRACT_ADDRESS, V2_CONTRACT_ADDRESS].filter(
    (c): c is string => Boolean(c),
  );

  if (contractAddresses.length === 0) {
    console.error('No Async contract addresses configured for this network.');
    return NextResponse.json(
      { error: 'Server configuration error: No contract addresses configured' },
      { status: 500 },
    );
  }

  try {
    // ACTIVE_NETWORK: 1 = Mainnet, 5 = Goerli
    const network = ACTIVE_NETWORK === 5 ? 'eth-goerli' : 'eth-mainnet';
    const baseUrl = `https://${network}.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner`;

    const ownedNfts: AlchemyOwnedNft[] = [];
    let pageKey: string | undefined;
    let pageCount = 0;

    do {
      const params = new URLSearchParams();
      params.set('owner', address);
      contractAddresses.forEach((contractAddress) => {
        params.append('contractAddresses[]', contractAddress);
      });
      params.set('withMetadata', 'false');
      params.set('pageSize', '100');
      if (pageKey) {
        params.set('pageKey', pageKey);
      }

      const response = await fetch(`${baseUrl}?${params.toString()}`);

      if (!response.ok) {
        const errorText = await response.text();
        // Log the full upstream error server-side only - never echo it to
        // the client. Alchemy embeds the API key in the request URL/path,
        // and some upstream error bodies (or gateway/WAF pages) can include
        // the requested URI verbatim, which would leak the key into the
        // browser's network tab if forwarded.
        console.error(
          `Alchemy NFT API Error: ${response.status} ${response.statusText} - ${errorText}`,
        );
        return NextResponse.json(
          { error: 'Failed to fetch owned NFTs from indexer' },
          { status: response.status },
        );
      }

      const data = (await response.json()) as AlchemyGetNftsForOwnerResponse;
      ownedNfts.push(...(data.ownedNfts || []));
      pageKey = data.pageKey;
      pageCount += 1;
    } while (pageKey && pageCount < MAX_PAGES);

    // Alchemy's response occasionally includes entries missing `contract` or
    // `tokenId` (e.g. malformed/spam collection entries) - skip those rather
    // than letting one bad entry crash the whole request.
    const items = ownedNfts
      .map((nft) => {
        const contractAddress = nft.contractAddress ?? nft.contract?.address;
        const rawTokenId = nft.tokenId;
        if (!contractAddress || !rawTokenId) return null;

        const tokenId = rawTokenId.startsWith('0x')
          ? BigInt(rawTokenId).toString()
          : rawTokenId;

        return {
          contractAddress: contractAddress.toLowerCase(),
          tokenId,
        };
      })
      .filter(
        (item): item is { contractAddress: string; tokenId: string } =>
          item !== null,
      );

    return NextResponse.json({ items });
  } catch (error: any) {
    // Same reasoning as above: log server-side only, don't forward
    // error.message to the client (it can embed the request URL, which
    // contains the Alchemy key).
    console.error('Owned NFTs Proxy Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
