'use client';

import { Address } from 'viem';
import { useEnsNameLookup } from '@/hooks/useEnsNameLookup';

type AddressWithEnsProps = {
  address: Address;
  /** Show "0x1234...abcd" instead of the full address. */
  truncate?: boolean;
  /** Wrap the address in a link to its Etherscan page. */
  etherscanLink?: boolean;
  className?: string;
};

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Renders a wallet address, with its ENS name (if any) shown underneath
 * once resolved. ENS only exists on mainnet, so this resolves there
 * regardless of which network the rest of the app is active on.
 */
export default function AddressWithEns({
  address,
  truncate = false,
  etherscanLink = false,
  className,
}: AddressWithEnsProps) {
  const { data: ensName } = useEnsNameLookup(address);
  const display = truncate ? truncateAddress(address) : address;

  return (
    <span className={className}>
      {etherscanLink ? (
        <a
          href={`https://etherscan.io/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          {display}
        </a>
      ) : (
        display
      )}
      {ensName && (
        <span className="block text-xs text-text-muted mt-0.5">{ensName}</span>
      )}
    </span>
  );
}
