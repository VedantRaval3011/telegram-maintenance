"use client";
import React, { useMemo } from "react";

type Ticket = any;

interface Props {
  tickets: Ticket[];
  filters: {
    category: string;
    location: string;
    status: string;
    name: string;
    dateFrom: string;
    dateTo: string;
    timeFrom: string;
    timeTo: string;
    sortBy: string;
  };
  setFilters: (patch: Partial<Props["filters"]>) => void;
  reset: () => void;
}

export default function FilterBar({ tickets, filters, setFilters, reset }: Props) {
  // compute unique options
  const categories = useMemo(() => {
    const s = new Set<string>();
    tickets.forEach(t => t.category && s.add(t.category));
    return Array.from(s).sort();
  }, [tickets]);

  const locations = useMemo(() => {
    const s = new Set<string>();
    tickets.forEach(t => t.location && s.add(t.location));
    return Array.from(s).sort();
  }, [tickets]);

  return (
    <div className="card-soft">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-500">Category</label>
          <select
            value={filters.category}
            onChange={(e) => setFilters({ category: e.target.value })}
            className="input-base"
          >
            <option value="">All</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-500">Location</label>
          <select
            value={filters.location}
            onChange={(e) => setFilters({ location: e.target.value })}
            className="input-base"
          >
            <option value="">All</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-500">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value })}
            className="input-base"
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="IN_PROGRESS">In Progress</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-500">Created Date</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ dateFrom: e.target.value })}
              className="input-base"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ dateTo: e.target.value })}
              className="input-base"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-500">Created Time</label>
          <div className="flex gap-2">
            <input
              type="time"
              value={filters.timeFrom}
              onChange={(e) => setFilters({ timeFrom: e.target.value })}
              className="input-base"
            />
            <input
              type="time"
              value={filters.timeTo}
              onChange={(e) => setFilters({ timeTo: e.target.value })}
              className="input-base"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-500">Created By / Name</label>
          <input
            type="text"
            placeholder="Search name..."
            value={filters.name}
            onChange={(e) => setFilters({ name: e.target.value })}
            className="input-base"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 mt-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 mr-2">Sort</label>
          <select
            value={filters.sortBy}
            onChange={(e) => setFilters({ sortBy: e.target.value })}
            className="input-base"
          >
            <option value="">None</option>
            <option value="created_desc">Created (new → old)</option>
            <option value="created_asc">Created (old → new)</option>
            <option value="priority_desc">Priority (high → low)</option>
            <option value="priority_asc">Priority (low → high)</option>
            <option value="category_asc">Category A→Z</option>
            <option value="category_desc">Category Z→A</option>
            <option value="location_asc">Location A→Z</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            className="px-3 py-1 bg-gray-100 rounded-md hover:bg-gray-200 text-sm"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
