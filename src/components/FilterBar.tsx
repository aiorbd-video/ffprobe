import React from 'react';
import { Search, SlidersHorizontal, ArrowUpDown, Cpu } from 'lucide-react';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  statusFilter: 'all' | 'active' | 'dead' | 'untested';
  onStatusFilterChange: (status: 'all' | 'active' | 'dead' | 'untested') => void;
  categories: { name: string; count: number }[];
  sortBy: 'group' | 'name' | 'latency' | 'links';
  onSortChange: (sort: 'group' | 'name' | 'latency' | 'links') => void;
  concurrency: number;
  onConcurrencyChange: (limit: number) => void;
  totalFiltered: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
  statusFilter,
  onStatusFilterChange,
  categories,
  sortBy,
  onSortChange,
  concurrency,
  onConcurrencyChange,
  totalFiltered
}) => {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-sm">
      {/* Top row: Search input, Concurrency & Sort */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search channel name, group, or URL..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-sm text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300 font-mono"
            >
              Clear
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold w-full sm:w-auto justify-between sm:justify-start">
          <button
            onClick={() => onStatusFilterChange('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => onStatusFilterChange('active')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'active'
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800 shadow-xs'
                : 'text-slate-400 hover:text-emerald-400'
            }`}
          >
            Working
          </button>
          <button
            onClick={() => onStatusFilterChange('dead')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'dead'
                ? 'bg-red-950/80 text-red-300 border border-red-800 shadow-xs'
                : 'text-slate-400 hover:text-red-400'
            }`}
          >
            Dead
          </button>
          <button
            onClick={() => onStatusFilterChange('untested')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'untested'
                ? 'bg-slate-800 text-amber-300 shadow-xs'
                : 'text-slate-400 hover:text-amber-400'
            }`}
          >
            Untested
          </button>
        </div>

        {/* Sort & Concurrency Controls */}
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          {/* Concurrency Selector */}
          <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs font-mono">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400 hidden lg:inline">Threads:</span>
            <select
              value={concurrency}
              onChange={e => onConcurrencyChange(Number(e.target.value))}
              className="bg-transparent text-slate-200 focus:outline-hidden cursor-pointer font-bold text-xs"
              title="Parallel stream testing concurrency"
            >
              <option value={10} className="bg-slate-900">10</option>
              <option value={25} className="bg-slate-900">25</option>
              <option value={50} className="bg-slate-900">50 (Default)</option>
              <option value={100} className="bg-slate-900">100 (Max)</option>
            </select>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs font-mono">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={e => onSortChange(e.target.value as any)}
              className="bg-transparent text-slate-200 focus:outline-hidden cursor-pointer text-xs"
            >
              <option value="group" className="bg-slate-900">Sort: Group & Name</option>
              <option value="name" className="bg-slate-900">Sort: Name (A-Z)</option>
              <option value="latency" className="bg-slate-900">Sort: Fastest Latency</option>
              <option value="links" className="bg-slate-900">Sort: Most Links</option>
            </select>
          </div>
        </div>
      </div>

      {/* Categories Pills Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar text-xs">
        <button
          onClick={() => onSelectCategory('all')}
          className={`px-3 py-1 rounded-full whitespace-nowrap transition font-medium ${
            selectedCategory === 'all'
              ? 'bg-cyan-500 text-slate-950 font-bold'
              : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          All Categories ({totalFiltered})
        </button>

        {categories.map(cat => {
          const isSelected = selectedCategory === cat.name;
          return (
            <button
              key={cat.name}
              onClick={() => onSelectCategory(cat.name)}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition font-mono ${
                isSelected
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat.name} ({cat.count})
            </button>
          );
        })}
      </div>
    </div>
  );
};
