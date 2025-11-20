"use client";
import React, { useMemo, useState, useCallback } from "react";
import useSWR from "swr";
import TicketCard from "@/components/TicketCard";
import SyncUsersButton from "@/components/SyncUsersButton";
import Navbar from "@/components/Navbar";
import FilterBar from "@/components/FilterBar";

const fetcher = (url: string) => fetch(url).then(r => r.json());

function SummaryStat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="card-soft">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">{label}</div>
          <div className="mt-1 text-2xl font-semibold text-gray-800">{value}</div>
        </div>
        <div className={`rounded-full p-3 shadow-sm`} style={{ background: accent ?? "linear-gradient(90deg,#0ea5a4,#2563eb)" }}>
          {/* decorative circle */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 2v20" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, error, mutate } = useSWR("/api/tickets", fetcher, { refreshInterval: 3000 });

  const [filters, setFiltersState] = useState({
    category: "",
    location: "",
    status: "",
    name: "",
    dateFrom: "",
    dateTo: "",
    timeFrom: "",
    timeTo: "",
    sortBy: "",
  });

  const setFilters = useCallback((patch: Partial<typeof filters>) => {
    setFiltersState(prev => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState({
      category: "",
      location: "",
      status: "",
      name: "",
      dateFrom: "",
      dateTo: "",
      timeFrom: "",
      timeTo: "",
      sortBy: "",
    });
  }, []);

  if (error) return <div className="p-6">Failed to load</div>;
  if (!data) return <div className="p-6">Loading…</div>;

  const tickets = Array.isArray(data.data) ? data.data : [];

  // summary top bar counts (unchanged)
  const summary = useMemo(() => {
    const total = tickets.length;
    const pending = tickets.filter((t: any) => t.status === "PENDING").length;
    const completed = tickets.filter((t: any) => t.status === "COMPLETED").length;
    const inProgress = tickets.filter((t: any) => t.status === "IN_PROGRESS" || t.status === "IN PROGRESS").length;
    return { total, pending, completed, inProgress };
  }, [tickets]);

  // apply filters client-side (unchanged)
  const filtered = useMemo(() => {
    const {
      category, location, status, name,
      dateFrom, dateTo, timeFrom, timeTo, sortBy
    } = filters;

    let out = tickets.slice();

    if (category) out = out.filter((t: any) => (t.category || "").toString().toLowerCase() === category.toLowerCase());
    if (location) out = out.filter((t: any) => (t.location || "").toString().toLowerCase() === location.toLowerCase());
    if (status) out = out.filter((t: any) => (t.status || "").toString().toLowerCase() === status.toLowerCase());
    if (name) {
      const q = name.toLowerCase();
      out = out.filter((t: any) => {
        const createdBy = (t.createdBy || "").toString().toLowerCase();
        const description = (t.description || "").toString().toLowerCase();
        return createdBy.includes(q) || description.includes(q);
      });
    }

    // date/time filtering: assume ticket.createdAt exists or ticket.createdOn
    const parseTicketDate = (t: any) => {
      const raw = t.createdAt || t.createdOn || t.created_at || t.created; // try several keys
      if (!raw) return null;
      try {
        return new Date(raw);
      } catch {
        return null;
      }
    };

    if (dateFrom) {
      const dFrom = new Date(dateFrom + "T00:00:00");
      out = out.filter((t: any) => {
        const d = parseTicketDate(t);
        return d ? d >= dFrom : false;
      });
    }
    if (dateTo) {
      const dTo = new Date(dateTo + "T23:59:59");
      out = out.filter((t: any) => {
        const d = parseTicketDate(t);
        return d ? d <= dTo : false;
      });
    }

    if (timeFrom || timeTo) {
      out = out.filter((t: any) => {
        const d = parseTicketDate(t);
        if (!d) return false;
        const hhmm = `${d.getHours()}`.padStart(2, "0") + ":" + `${d.getMinutes()}`.padStart(2, "0");
        if (timeFrom && hhmm < timeFrom) return false;
        if (timeTo && hhmm > timeTo) return false;
        return true;
      });
    }

    // sort
    if (sortBy) {
      if (sortBy === "created_desc") {
        out.sort((a: any, b: any) => {
          const da = parseTicketDate(a)?.getTime() ?? 0;
          const db = parseTicketDate(b)?.getTime() ?? 0;
          return db - da;
        });
      } else if (sortBy === "created_asc") {
        out.sort((a: any, b: any) => {
          const da = parseTicketDate(a)?.getTime() ?? 0;
          const db = parseTicketDate(b)?.getTime() ?? 0;
          return da - db;
        });
      } else if (sortBy === "priority_desc") {
        out.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
      } else if (sortBy === "priority_asc") {
        out.sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0));
      } else if (sortBy === "category_asc") {
        out.sort((a: any, b: any) => String(a.category || "").localeCompare(String(b.category || "")));
      } else if (sortBy === "category_desc") {
        out.sort((a: any, b: any) => String(b.category || "").localeCompare(String(a.category || "")));
      } else if (sortBy === "location_asc") {
        out.sort((a: any, b: any) => String(a.location || "").localeCompare(String(b.location || "")));
      }
    }

    return out;
  }, [tickets, filters]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Navbar />

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Maintenance Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Live data from your /api/tickets · updated automatically</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <SyncUsersButton />
          </div>
        </div>
      </div>

      {/* Summary horizontal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryStat label="Total Tickets" value={summary.total} accent="linear-gradient(90deg,#eef2ff,#c7d2fe)" />
        <SummaryStat label="Pending" value={summary.pending} accent="linear-gradient(90deg,#fff7ed,#fef3c7)" />
        <SummaryStat label="In Progress" value={summary.inProgress} accent="linear-gradient(90deg,#eff6ff,#dbeafe)" />
        <SummaryStat label="Completed" value={summary.completed} accent="linear-gradient(90deg,#ecfdf5,#bbf7d0)" />
      </div>

      {/* Filters */}
      <div className="mb-6">
        <FilterBar tickets={tickets} filters={filters} setFilters={setFilters} reset={resetFilters} />
      </div>

      {/* Tickets grid */}
      <div className="grid grid-cols-1 gap-4">
        {filtered.map((t: any) => (
          <TicketCard key={t.ticketId} ticket={t} onStatusChange={() => mutate()} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="mt-6 text-center text-gray-500">No tickets match the current filters.</div>
      )}
    </div>
  );
}
