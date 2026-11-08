import { IPFS_PATH_GATEWAYS } from '@/utils/ipfs-gateways';
import Link from 'next/link';
import ArtistCredit from '@/components/artist-credit';
import { notFound } from 'next/navigation';
import ArchivePreview from '@/components/archive-preview';
import DynamicExpansionPreview from '@/components/dynamic-expansion-preview';
import BlueprintPlayer from '@/components/blueprint-player';
import { getArchiveRecordByCid } from '@/utils/archive-search';
import { familyTitle } from '@/utils/archive-families';

export default function MetadataArtworkPage({
  params,
}: {
  params: { cid: string };
}) {
  const record = getArchiveRecordByCid(params.cid);
  if (!record) notFound();
  const Preview =
    record.family === 'dynamic-blueprints'
      ? DynamicExpansionPreview
      : ArchivePreview;
  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <Link
        className="text-accent underline text-sm"
        href={
          ['blueprints', 'music-blueprints'].includes(record.family) &&
          record.blueprintId
            ? `/archive/blueprints/project/${record.blueprintId}`
            : `/search?${new URLSearchParams({ family: record.family })}`
        }
      >
        Back to{' '}
        {['blueprints', 'music-blueprints'].includes(record.family) &&
        record.blueprintId
          ? 'project editions'
          : familyTitle(record.family)}
      </Link>
      <h1 className="text-3xl font-bold mt-6 mb-2 break-words">
        {record.name}
      </h1>
      <p className="text-text-muted mb-6">
        <ArtistCredit recordId={record.id} credit={record.artist} />
      </p>
      {record.family === 'music-blueprints' ? (
        <BlueprintPlayer
          key={record.cid}
          name={record.name}
          cid={record.cid}
          image={record.image}
          animationUrl={record.animationUrl}
        />
      ) : (
        <Preview
          name={record.name}
          cid={record.cid}
          image={record.image}
          large
        />
      )}
      <p className="text-sm text-text-muted my-6">
        {['blueprints', 'music-blueprints'].includes(record.family)
          ? 'Artwork from the edition’s original metadata. Blueprint editions are fixed once minted.'
          : record.family === 'dynamic-blueprints'
            ? 'Original expansion item media. The changing core composition is still being restored.'
            : 'Artwork media from the original metadata.'}
      </p>
      {record.description && (
        <p className="whitespace-pre-line mb-6">{record.description}</p>
      )}
      <dl className="text-sm break-all space-y-2">
        {record.collection && (
          <div>
            <dt className="font-semibold inline">Collection: </dt>
            <dd className="inline">{record.collection}</dd>
          </div>
        )}
        {record.coreAddress && (
          <div>
            <dt className="font-semibold inline">Metadata core contract: </dt>
            <dd className="inline">
              <Link
                className="text-accent underline"
                href={`/search?${new URLSearchParams({ q: record.coreAddress, family: 'dynamic-blueprints' })}`}
              >
                {record.coreAddress}
              </Link>
            </dd>
          </div>
        )}
        {record.slot && (
          <div>
            <dt className="font-semibold inline">Slot: </dt>
            <dd className="inline">{record.slot}</dd>
          </div>
        )}
        {record.tokenId && (
          <div>
            <dt className="font-semibold inline">Reported token: </dt>
            <dd className="inline">{record.tokenId}</dd>
          </div>
        )}
        {record.contractAddress && (
          <div>
            <dt className="font-semibold inline">Reported contract: </dt>
            <dd className="inline">{record.contractAddress}</dd>
          </div>
        )}
        <div>
          <dt className="font-semibold inline">Metadata CID: </dt>
          <dd className="inline">{record.cid}</dd>
        </div>
      </dl>
      <a
        className="text-accent underline inline-block mt-5"
        href={`${IPFS_PATH_GATEWAYS[0]}${record.cid}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        View original metadata ↗
      </a>
      {record.metadataLocal && (
        <a
          className="text-accent underline block mt-3"
          href={`/archive/metadata/${record.cid}.json`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View preserved metadata copy ↗
        </a>
      )}
      {record.metadataVerified && (
        <p className="text-success text-sm mt-3">
          Original metadata CID verified
        </p>
      )}
    </main>
  );
}
