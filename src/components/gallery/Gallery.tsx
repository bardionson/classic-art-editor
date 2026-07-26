'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, ArrowDown, ArrowUp, Info } from 'react-feather';
import { Address } from 'viem';
import { useLayerDetailModal } from '@/components/layer/layer-detail-provider';

export interface GalleryItem {
  id: string;
  tokenId: string;
  name: string;
  description?: string;
  imageUrl: string;
  artistName?: string;
  link: string;
  date?: number; // timestamp or simply number for sorting
  contractAddress?: string;
  isLayer?: boolean;
}

interface GalleryProps {
  title: string;
  items: GalleryItem[];
  embedded?: boolean;
  /**
   * When set, renders at most this many items and suppresses pagination
   * controls entirely. Intended for short "teaser" embeds (e.g. the
   * homepage), not for full gallery pages.
   */
  limit?: number;
  /** Initial sort control state; defaults preserve prior behavior (Name/asc). */
  defaultSortOption?: SortOption;
  defaultSortDirection?: SortDirection;
}

type SortOption = 'name' | 'date';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 24;

export default function Gallery({
  title,
  items,
  embedded = false,
  limit,
  defaultSortOption = 'name',
  defaultSortDirection = 'asc',
}: GalleryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>(defaultSortOption);
  const [sortDirection, setSortDirection] =
    useState<SortDirection>(defaultSortDirection);
  const [currentPage, setCurrentPage] = useState(1);
  const { openLayer } = useLayerDetailModal();

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(searchLower) ||
        item.artistName?.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower)
      );
    });
  }, [items, searchTerm]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let comparison = 0;
      if (sortOption === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortOption === 'date') {
        // Fallback to 0 if date is missing
        const dateA = a.date ?? 0;
        const dateB = b.date ?? 0;
        comparison = dateA - dateB;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredItems, sortOption, sortDirection]);

  const totalPages = limit
    ? 1
    : Math.max(1, Math.ceil(sortedItems.length / PAGE_SIZE));

  // Clamp during render (rather than resetting via an effect after commit)
  // so a stale currentPage from before a search/sort change never produces
  // an out-of-range page or an empty grid for a render before an effect
  // corrects it.
  const effectivePage = Math.min(currentPage, totalPages);

  const pagedItems = useMemo(() => {
    if (limit) {
      return sortedItems.slice(0, limit);
    }
    const start = (effectivePage - 1) * PAGE_SIZE;
    return sortedItems.slice(start, start + PAGE_SIZE);
  }, [sortedItems, effectivePage, limit]);

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const Heading = embedded ? 'h2' : 'h1';

  return (
    <div className={embedded ? '' : 'container mx-auto px-4 py-8'}>
      <div className="mb-8">
        <Heading
          className={
            embedded ? 'text-2xl font-bold mb-4' : 'text-3xl font-bold mb-4'
          }
        >
          {title}
        </Heading>

        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          {/* Search */}
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-text-muted" />
            </div>
            <input
              type="text"
              placeholder="Search by name, artist, description..."
              className="pl-10 pr-4 py-2 border-border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-accent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-text-muted whitespace-nowrap shrink-0">
              Sort by:
            </span>
            <select
              className="border-border rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent min-w-0"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
            >
              <option value="name">Name</option>
              <option value="date">Date (Token ID)</option>
            </select>
            <button
              onClick={toggleSortDirection}
              className="p-2 border border-border rounded-lg hover:bg-surface-sunken shrink-0"
              title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDirection === 'asc' ? (
                <ArrowUp size={20} />
              ) : (
                <ArrowDown size={20} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      {sortedItems.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          No items found matching your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {pagedItems.map((item) => (
            <Link key={item.id} href={item.link} className="group">
              <div className="bg-surface-raised border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
                <div className="aspect-square overflow-hidden bg-surface-sunken relative">
                  {item.isLayer && item.contractAddress && (
                    <button
                      type="button"
                      aria-label="View layer details"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openLayer(
                          item.contractAddress as Address,
                          item.tokenId,
                        );
                      }}
                      className="absolute top-2 right-2 z-10 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full transition border border-white/10"
                    >
                      <Info size={16} />
                    </button>
                  )}
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-muted text-sm">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-semibold text-lg text-text line-clamp-2 mb-1 group-hover:text-accent transition-colors">
                    {item.name}
                  </h3>
                  {item.artistName && (
                    <p className="text-sm text-text-muted mb-2">
                      {item.artistName}
                    </p>
                  )}
                  {item.description && (
                    <p className="text-sm text-text-muted line-clamp-3 mb-4 flex-1">
                      {item.description}
                    </p>
                  )}
                  <div className="text-xs text-text-muted mt-auto pt-2 border-t border-border">
                    Token ID: {item.tokenId}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!limit && sortedItems.length > 0 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setCurrentPage(Math.max(1, effectivePage - 1))}
            disabled={effectivePage <= 1}
          >
            Previous
          </button>
          <span className="text-sm text-text-muted whitespace-nowrap">
            Page {effectivePage} of {totalPages}
          </span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setCurrentPage(Math.min(totalPages, effectivePage + 1))
            }
            disabled={effectivePage >= totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
