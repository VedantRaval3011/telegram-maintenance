// app/dashboard/page.tsx
"use client";
import React from "react";
import useSWR from "swr";
import TicketCard from "@/components/TicketCard";
import SyncUsersButton from "@/components/SyncUsersButton";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function DashboardPage() {
  const { data, error, mutate } = useSWR("/api/tickets", fetcher, { refreshInterval: 3000 });

  if (error) return <div className="p-4">Failed to load</div>;
  if (!data) return <div className="p-4">Loading…</div>;

  const tickets = data.data || [];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Maintenance Dashboard</h1>
        <SyncUsersButton />
      </div>
      <div className="grid gap-4">
        {tickets.map((t: any) => (
          <TicketCard key={t.ticketId} ticket={t} onStatusChange={() => mutate()} />
        ))}
      </div>
    </div>
  );
}
