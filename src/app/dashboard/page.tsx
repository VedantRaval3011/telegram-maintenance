// app/dashboard/page.tsx
"use client";
import React from "react";
import useSWR from "swr";
import TicketCard from "@/components/TicketCard";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function DashboardPage() {
  const { data, error, mutate } = useSWR("/api/tickets", fetcher, { refreshInterval: 3000 });

  if (error) return <div className="p-4">Failed to load</div>;
  if (!data) return <div className="p-4">Loading…</div>;

  const tickets = data.data || [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Maintenance Dashboard</h1>
      <div className="grid gap-4">
        {tickets.map((t: any) => (
          <TicketCard key={t.ticketId} ticket={t} onStatusChange={() => mutate()} />
        ))}
      </div>
    </div>
  );
}
