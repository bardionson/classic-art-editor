'use client';
import Link from 'next/link';
import { artistCreditParts } from '@/utils/artist-links';
export default function ArtistName({
  credit,
  allowedAddresses,
}: {
  credit: string;
  allowedAddresses?: string[];
}) {
  return (
    <>
      {artistCreditParts(credit, allowedAddresses).map((part, index) =>
        part.href ? (
          <Link
            key={index}
            href={part.href}
            className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            onClick={(event) => event.stopPropagation()}
          >
            {part.text}
          </Link>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}
