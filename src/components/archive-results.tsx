import Link from 'next/link';
import ArtistCredit from '@/components/artist-credit';
import ArchivePreview from '@/components/archive-preview';
import { familyTitle } from '@/utils/archive-families';
import {
  displayStatus,
  displayStatusLabel,
  type ArchiveRecord,
} from '@/utils/archive-search';

export default function ArchiveResults({
  records,
  annotations = {},
}: {
  records: ArchiveRecord[];
  annotations?: Record<string, string>;
}) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {records.map((record) => {
        const href =
          record.link ||
          (record.cid ? `/archive/metadata/${record.cid}` : null);
        return (
          <li
            key={record.id}
            className="rounded-xl border border-border bg-surface-raised p-4 min-w-0"
          >
            {href ? (
              <Link href={href} aria-label={`View ${record.name}`}>
                <ArchivePreview
                  name={record.name}
                  cid={record.cid}
                  image={record.image}
                />
              </Link>
            ) : (
              <ArchivePreview
                name={record.name}
                cid={record.cid}
                image={record.image}
              />
            )}
            <p className="text-xs text-text-muted mt-4 mb-2">
              {familyTitle(record.family)} · {record.kind}
            </p>
            <h2 className="text-lg font-semibold break-words">
              {href ? (
                <Link className="hover:underline" href={href}>
                  {record.name}
                </Link>
              ) : (
                record.name
              )}
            </h2>
            {record.artist && (
              <p className="mt-1 text-sm text-text-muted break-words">
                <ArtistCredit recordId={record.id} credit={record.artist} />
              </p>
            )}
            {annotations[record.id] && (
              <p className="mt-2 text-sm text-text-muted">
                {annotations[record.id]}
              </p>
            )}
            {['blueprints', 'music-blueprints'].includes(record.family) &&
              record.blueprintId && (
                <Link
                  className="inline-block mt-2 text-xs text-accent underline"
                  href={`/archive/blueprints/project/${record.blueprintId}`}
                >
                  Browse this project
                </Link>
              )}
            {record.collection && (
              <p className="text-xs text-text-muted mt-1">
                {record.collection}
              </p>
            )}
            <p className="text-xs mt-3">
              {displayStatusLabel(displayStatus(record))}
            </p>
            {record.metadataVerified && (
              <p className="text-xs text-success mt-1">
                Original metadata CID verified
              </p>
            )}
            <details className="mt-3 text-xs text-text-muted break-all">
              <summary className="cursor-pointer py-1">
                Archive identity & sources
              </summary>
              <dl className="space-y-1 mt-2">
                {record.tokenId && (
                  <div>
                    <dt className="inline font-semibold">Token ID: </dt>
                    <dd className="inline">{record.tokenId}</dd>
                  </div>
                )}
                {record.contractAddress && (
                  <div>
                    <dt className="inline font-semibold">Contract: </dt>
                    <dd className="inline">{record.contractAddress}</dd>
                  </div>
                )}
                {record.coreAddress && (
                  <div>
                    <dt className="inline font-semibold">Referenced core: </dt>
                    <dd className="inline">{record.coreAddress}</dd>
                  </div>
                )}
                {record.cid && (
                  <div>
                    <dt className="inline font-semibold">Metadata CID: </dt>
                    <dd className="inline">{record.cid}</dd>
                  </div>
                )}
              </dl>
              <p className="mt-2">Source: {record.source}</p>
              {record.identityStatus === 'reported' && (
                <p className="mt-2">
                  Collection and token identity reported in recovery records;
                  verification pending.
                </p>
              )}
              {record.cid && (
                <a
                  className="text-accent underline inline-block mt-2"
                  href={`https://gateway.pinata.cloud/ipfs/${record.cid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Original metadata ↗
                </a>
              )}
            </details>
            {href && (
              <Link
                href={href}
                className="text-accent underline inline-block text-sm font-medium mt-4"
              >
                {record.link
                  ? record.family === 'music' && record.kind === 'Master'
                    ? 'Listen & view artwork'
                    : 'Open artwork'
                  : record.family === 'music-blueprints'
                    ? 'Listen & view artwork'
                    : 'View artwork preview'}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
