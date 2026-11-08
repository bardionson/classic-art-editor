import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import BlueprintPlayer from '@/components/blueprint-player';
import ArchivePreview from '@/components/archive-preview';
import DreamRecorderCredit from '@/components/dream-recorder-credit';
import { IPFS_PATH_GATEWAYS } from '@/utils/ipfs-gateways';
import {
  dreamRecorder,
  dreamEditions,
  dreamProjectHref,
  dreamEditionHref,
  dreamMetadataUri,
  dreamMediaUri,
} from '@/utils/dream-recorder';

type Props = { params: { projectId: string; tokenId: string } };
function edition({ projectId, tokenId }: Props['params']) {
  if (
    projectId !== dreamRecorder.projectId ||
    !Object.hasOwn(dreamEditions, tokenId)
  )
    notFound();
  return dreamEditions[tokenId];
}
export function generateMetadata({ params }: Props): Metadata {
  const e = edition(params);
  return { title: `${e.name} · Dream Recorder | Async Art` };
}
export default function DreamEditionPage({ params }: Props) {
  const e = edition(params);
  const token = Number(params.tokenId);
  const audio = e.animation.startsWith('Qm');
  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <Link href={dreamProjectHref} className="text-accent underline">
        ← All Dream Recorder editions
      </Link>
      <h1 className="text-3xl font-bold mt-6 mb-2">{e.name}</h1>
      <p className="text-text-muted">
        The Guild_NFT · {e.musician || 'Legendary Edition'} · Token #
        {params.tokenId}
      </p>
      <DreamRecorderCredit />
      {audio ? (
        <BlueprintPlayer
          key={params.tokenId}
          name={e.name}
          cid={e.cid}
          image={dreamMediaUri(e.image)}
          audioUrl={dreamMediaUri(e.animation)}
          animationUrl={dreamMediaUri(e.animation)}
        />
      ) : (
        <>
          <ArchivePreview
            name={e.name}
            cid={e.cid}
            image={dreamMediaUri(e.image)}
            large
          />
          <p role="status" className="my-5 rounded-xl border border-border p-4">
            This legendary edition’s original video host is no longer serving
            its file. Its artwork and traits are preserved; video recovery is
            still needed.
          </p>
          <a
            href={e.animation}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline"
          >
            Original video reference ↗
          </a>
        </>
      )}
      <nav
        aria-label="Browse editions"
        className="flex flex-wrap justify-between gap-4 my-8"
      >
        {dreamEditions[String(token - 1)] && (
          <Link
            href={dreamEditionHref(String(token - 1))}
            className="text-accent underline"
          >
            ← Previous edition
          </Link>
        )}
        {dreamEditions[String(token + 1)] && (
          <Link
            href={dreamEditionHref(String(token + 1))}
            className="text-accent underline"
          >
            Next edition →
          </Link>
        )}
      </nav>
      <p className="text-sm text-text-muted mb-5">
        Each minted edition has a fixed composition. Artwork, media references
        and traits were recovered from The Guild Archive; its token metadata URI
        was verified on Ethereum.
      </p>
      <h2 className="text-xl font-semibold mb-4">Edition traits</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {e.attributes.map((a, i) => (
          <div key={i} className="rounded-lg border border-border p-3 min-w-0">
            <dt className="text-xs text-text-muted break-words">
              {a.trait_type}
            </dt>
            <dd className="mt-1 break-words">{a.value}</dd>
          </div>
        ))}
      </dl>
      <details className="text-sm break-words">
        <summary className="cursor-pointer">
          About Dream Recorder & original sources
        </summary>
        <p className="whitespace-pre-line my-5">{dreamRecorder.description}</p>
        <p className="break-all">Contract: {dreamRecorder.contractAddress}</p>
        <a
          href={
            IPFS_PATH_GATEWAYS[0] +
            dreamMetadataUri(params.tokenId).replace('ipfs://', '')
          }
          className="text-accent underline block my-3"
          target="_blank"
          rel="noopener noreferrer"
        >
          Original on-chain metadata ↗
        </a>
        {e.cid && (
          <a
            href={`/archive/metadata/${e.cid}.json`}
            className="text-accent underline block my-3"
          >
            Preserved metadata copy · original CID verified
          </a>
        )}
        <a
          href="/archive/recovery/dream-recorder.json"
          className="text-accent underline"
        >
          Recovery evidence
        </a>
      </details>
    </main>
  );
}
