'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, ArrowDown, ArrowUp } from 'react-feather';

export interface GalleryItem {
  id: string;
  tokenId: string;
  name: string;
  description?: string;
  imageUrl: string;
  artistName?: string;
  link: string;
  date?: number; // timestamp or simply number for sorting
}

interface GalleryProps {
  title: string;
  items: GalleryItem[];
}

type SortOption = 'name' | 'date';
type SortDirection = 'asc' | 'desc';

export default function Gallery({ title, items }: GalleryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">{title}</h1>

        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          {/* Search */}
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by name, artist, description..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Sort by:</span>
            <select
              className="border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
            >
              <option value="name">Name</option>
              <option value="date">Date (Token ID)</option>
            </select>
            <button
              onClick={toggleSortDirection}
              className="p-2 border border-gray-300 rounded-md hover:bg-gray-100"
              title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDirection === 'asc' ? <ArrowUp size={20} /> : <ArrowDown size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      {sortedItems.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No items found matching your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {sortedItems.map((item) => (
            <Link key={item.id} href={item.link} className="group">
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
                <div className="aspect-square overflow-hidden bg-gray-100 relative">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-semibold text-lg text-gray-900 line-clamp-2 mb-1 group-hover:text-purple-600 transition-colors">
                    {item.name}
                  </h3>
                  {item.artistName && (
                    <p className="text-sm text-gray-500 mb-2">{item.artistName}</p>
                  )}
                  {item.description && (
                    <p className="text-sm text-gray-600 line-clamp-3 mb-4 flex-1">
                      {item.description}
                    </p>
                  )}
                  <div className="text-xs text-gray-400 mt-auto pt-2 border-t border-gray-100">
                    Token ID: {item.tokenId}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
