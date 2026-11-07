import Link from 'next/link';
import { archiveFamilies } from '@/utils/archive-families';

export default function ArchiveNavigation({ active }: { active?: string }) {
  return (
    <nav aria-label="Archive sections" className="flex flex-wrap gap-2 mb-8">
      {archiveFamilies.map((family) => (
        <Link
          key={family.id}
          href={`/archive/${family.id}`}
          aria-current={active === family.id ? 'page' : undefined}
          className={`rounded-full border px-4 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${active === family.id ? 'bg-accent text-text-inverse border-accent' : 'border-border hover:border-accent'}`}
        >
          {family.title}
        </Link>
      ))}
      <Link
        href="/search"
        className="rounded-full border border-border px-4 py-2 text-sm hover:border-accent"
      >
        Search everything
      </Link>
    </nav>
  );
}
