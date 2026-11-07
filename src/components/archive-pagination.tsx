import Link from 'next/link';

export default function ArchivePagination({
  pathname,
  params,
  page,
  totalPages,
}: {
  pathname: string;
  params: Record<string, string>;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const href = (next: number) =>
    `${pathname}?${new URLSearchParams({ ...params, page: String(next) })}`;
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center gap-5 mt-8"
    >
      {page > 1 && (
        <Link className="text-accent underline" href={href(page - 1)}>
          Previous page
        </Link>
      )}
      <span>
        Page {page} of {totalPages}
      </span>
      {page < totalPages && (
        <Link className="text-accent underline" href={href(page + 1)}>
          Next page
        </Link>
      )}
    </nav>
  );
}
