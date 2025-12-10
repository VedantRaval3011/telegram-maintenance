"use client";
import React, { useMemo, useState } from "react";

type Ticket = any;

interface Props {
  tickets: Ticket[];
  filters: {
    category: string;
    location: string;
    status: string;
    priority: string;
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
  const [showExtendedFilters, setShowExtendedFilters] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState<string>("");

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

  // Calculate filtered count for a specific date range
  const getFilteredCount = useMemo(() => {
    return (dateFrom: string, dateTo: string) => {
      let filtered = tickets.slice();

      // Apply current filters (category, location, status)
      if (filters.category) {
        filtered = filtered.filter((t: any) => 
          (t.category || "").toString().toLowerCase() === filters.category.toLowerCase()
        );
      }

      if (filters.location) {
        filtered = filtered.filter((t: any) => 
          (t.location || "").toString().toLowerCase() === filters.location.toLowerCase()
        );
      }

      if (filters.status) {
        filtered = filtered.filter((t: any) => 
          (t.status || "").toString().toLowerCase() === filters.status.toLowerCase()
        );
      }

      // Apply date range filter
      const parseTicketDate = (t: any) => {
        const raw = t.createdAt || t.createdOn || t.created_at || t.created;
        if (!raw) return null;
        try {
          return new Date(raw);
        } catch {
          return null;
        }
      };

      const dFrom = new Date(dateFrom + "T00:00:00");
      const dTo = new Date(dateTo + "T23:59:59");
      
      filtered = filtered.filter((t: any) => {
        const d = parseTicketDate(t);
        return d ? (d >= dFrom && d <= dTo) : false;
      });

      return filtered.length;
    };
  }, [tickets, filters.category, filters.location, filters.status]);

  const handleDateRangeClick = (label: string, daysFrom: number, daysTo: number) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    const fromDate = new Date(today);
    const toDate = new Date(today);
    
    // For "0-5 Days": daysFrom=0 (today), daysTo=5 (5 days ago)
    // We want range from 5 days ago TO today
    fromDate.setDate(today.getDate() - daysTo);
    fromDate.setHours(0, 0, 0, 0); // Start of the day
    
    toDate.setDate(today.getDate() - daysFrom);
    toDate.setHours(23, 59, 59, 999); // End of the day
    
    setFilters({
      dateFrom: fromDate.toISOString().split('T')[0],
      dateTo: toDate.toISOString().split('T')[0]
    });
    setSelectedDateRange(label);
  };

  const handleMonthRangeClick = (label: string, monthsFrom: number, monthsTo: number) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    const fromDate = new Date(today);
    const toDate = new Date(today);
    
    // For "1-2 Months": monthsFrom=1, monthsTo=2
    // We want range from 2 months ago TO 1 month ago
    fromDate.setMonth(today.getMonth() - monthsTo);
    fromDate.setHours(0, 0, 0, 0); // Start of the day
    
    toDate.setMonth(today.getMonth() - monthsFrom);
    toDate.setHours(23, 59, 59, 999); // End of the day
    
    setFilters({
      dateFrom: fromDate.toISOString().split('T')[0],
      dateTo: toDate.toISOString().split('T')[0]
    });
    setSelectedDateRange(label);
  };

  const handleYearRangeClick = (label: string, years: number) => {
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    const fromDate = new Date(today);
    const toDate = new Date(today);
    
    // For "3 Years": we want tickets from 3 years ago to 2 years ago
    fromDate.setFullYear(today.getFullYear() - years);
    fromDate.setHours(0, 0, 0, 0); // Start of the day
    
    toDate.setFullYear(today.getFullYear() - (years - 1));
    toDate.setHours(23, 59, 59, 999); // End of the day
    
    setFilters({
      dateFrom: fromDate.toISOString().split('T')[0],
      dateTo: toDate.toISOString().split('T')[0]
    });
    setSelectedDateRange(label);
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl shadow-sm p-6 mb-4">
      {/* Basic Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-600 font-medium">Category</label>
          <select
            value={filters.category}
            onChange={(e) => setFilters({ category: e.target.value })}
            className="bg-white border border-gray-200 text-gray-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-gray-300 transition-all"
          >
            <option value="">All</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-600 font-medium">Location</label>
          <select
            value={filters.location}
            onChange={(e) => setFilters({ location: e.target.value })}
            className="bg-white border border-gray-200 text-gray-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-gray-300 transition-all"
          >
            <option value="">All</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-600 font-medium">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value })}
            className="bg-white border border-gray-200 text-gray-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-gray-300 transition-all"
          >
            <option value="PENDING">Pending</option>
          </select>
        </div>
      </div>

      {/* Primary Date Range Filters */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <label className="text-sm text-gray-800 font-semibold mb-3 block">Filter by Date Range</label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {/* Helper function to render button with count */}
          {(() => {
            const renderDateButton = (label: string, daysFrom: number, daysTo: number) => {
              const today = new Date();
              const fromDate = new Date(today);
              const toDate = new Date(today);
              fromDate.setDate(today.getDate() - daysTo);
              toDate.setDate(today.getDate() - daysFrom);
              
              const count = selectedDateRange === label 
                ? getFilteredCount(fromDate.toISOString().split('T')[0], toDate.toISOString().split('T')[0])
                : 0;

              return (
                <button
                  key={label}
                  onClick={() => handleDateRangeClick(label, daysFrom, daysTo)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                    selectedDateRange === label 
                      ? "bg-gray-300 text-gray-800 shadow-sm" 
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-200 hover:text-gray-800"
                  }`}
                >
                  <span>{label}</span>
                  {selectedDateRange === label && (
                    <span className="text-sm font-bold">{count}</span>
                  )}
                </button>
              );
            };

            const renderMonthButton = (label: string, monthsFrom: number, monthsTo: number) => {
              const today = new Date();
              const fromDate = new Date(today);
              const toDate = new Date(today);
              fromDate.setMonth(today.getMonth() - monthsTo);
              toDate.setMonth(today.getMonth() - monthsFrom);
              
              const count = selectedDateRange === label 
                ? getFilteredCount(fromDate.toISOString().split('T')[0], toDate.toISOString().split('T')[0])
                : 0;

              return (
                <button
                  key={label}
                  onClick={() => handleMonthRangeClick(label, monthsFrom, monthsTo)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                    selectedDateRange === label 
                      ? "bg-gray-300 text-gray-800 shadow-sm" 
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-200 hover:text-gray-800"
                  }`}
                >
                  <span>{label}</span>
                  {selectedDateRange === label && (
                    <span className="text-sm font-bold">{count}</span>
                  )}
                </button>
              );
            };

            return (
              <>
                {renderDateButton("0–5 Days", 0, 5)}
                {renderDateButton("5–14 Days", 5, 14)}
                {renderDateButton("14–21 Days", 14, 21)}
                {renderDateButton("21–31 Days", 21, 31)}
                {renderMonthButton("1–2 Months", 1, 2)}
                {renderMonthButton("2–3 Months", 2, 3)}
                {renderMonthButton("3–4 Months", 3, 4)}
                {renderMonthButton("4–5 Months", 4, 5)}
                {renderMonthButton("5–6 Months", 5, 6)}
                <button
                  onClick={() => {
                    setShowExtendedFilters(!showExtendedFilters);
                    if (!showExtendedFilters) {
                      handleMonthRangeClick("Above 6 Months", 6, 999);
                    }
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                    selectedDateRange === "Above 6 Months" 
                      ? "bg-gray-300 text-gray-800 shadow-sm" 
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-200 hover:text-gray-800"
                  }`}
                >
                  <span>Above 6 Months</span>
                  {selectedDateRange === "Above 6 Months" && (() => {
                    const today = new Date();
                    const fromDate = new Date(today);
                    fromDate.setMonth(today.getMonth() - 999);
                    const toDate = new Date(today);
                    toDate.setMonth(today.getMonth() - 6);
                    const count = getFilteredCount(fromDate.toISOString().split('T')[0], toDate.toISOString().split('T')[0]);
                    return <span className="text-sm font-bold">{count}</span>;
                  })()}
                </button>
              </>
            );
          })()}
        </div>
      </div>

      {/* Extended Filters (6-24 Months) */}
      {showExtendedFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="text-sm text-gray-800 font-semibold mb-3 block">Extended Filters</label>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {(() => {
              const renderMonthButton = (label: string, monthsFrom: number, monthsTo: number) => {
                const today = new Date();
                const fromDate = new Date(today);
                const toDate = new Date(today);
                fromDate.setMonth(today.getMonth() - monthsTo);
                toDate.setMonth(today.getMonth() - monthsFrom);
                
                const count = selectedDateRange === label 
                  ? getFilteredCount(fromDate.toISOString().split('T')[0], toDate.toISOString().split('T')[0])
                  : 0;

                return (
                  <button
                    key={label}
                    onClick={() => handleMonthRangeClick(label, monthsFrom, monthsTo)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                      selectedDateRange === label 
                        ? "bg-gray-300 text-gray-800 shadow-sm" 
                        : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-200 hover:text-gray-800"
                    }`}
                  >
                    <span>{label}</span>
                    {selectedDateRange === label && (
                      <span className="text-sm font-bold">{count}</span>
                    )}
                  </button>
                );
              };

              return (
                <>
                  {renderMonthButton("6–9 Months", 6, 9)}
                  {renderMonthButton("9–12 Months", 9, 12)}
                  {renderMonthButton("12–15 Months", 12, 15)}
                  {renderMonthButton("15–18 Months", 15, 18)}
                  {renderMonthButton("18–21 Months", 18, 21)}
                  {renderMonthButton("21–24 Months", 21, 24)}
                </>
              );
            })()}
          </div>

          {/* Further Category Expansion (Years) */}
          <div className="mt-4">
            <label className="text-sm text-gray-800 font-semibold mb-3 block">Further Category Expansion</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {(() => {
                const renderYearButton = (label: string, years: number) => {
                  const today = new Date();
                  const fromDate = new Date(today);
                  const toDate = new Date(today);
                  fromDate.setFullYear(today.getFullYear() - years);
                  toDate.setFullYear(today.getFullYear() - (years - 1));
                  
                  const count = selectedDateRange === label 
                    ? getFilteredCount(fromDate.toISOString().split('T')[0], toDate.toISOString().split('T')[0])
                    : 0;

                  return (
                    <button
                      key={label}
                      onClick={() => handleYearRangeClick(label, years)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                        selectedDateRange === label 
                          ? "bg-gray-300 text-gray-800 shadow-sm" 
                          : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-200 hover:text-gray-800"
                      }`}
                    >
                      <span>{label}</span>
                      {selectedDateRange === label && (
                        <span className="text-sm font-bold">{count}</span>
                      )}
                    </button>
                  );
                };

                return (
                  <>
                    {renderYearButton("3 Years", 3)}
                    {renderYearButton("4 Years", 4)}
                    {renderYearButton("5 Years", 5)}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Reset Button */}
      <div className="flex items-center justify-end gap-2 mt-6">
        <button
          onClick={() => {
            reset();
            setSelectedDateRange("");
            setShowExtendedFilters(false);
          }}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-all shadow-sm"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
