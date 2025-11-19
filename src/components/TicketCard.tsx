// components/TicketCard.tsx
"use client";
import React from "react";

export default function TicketCard({ ticket, onStatusChange }: { ticket: any, onStatusChange?: () => void }) {
  const markCompleted = async () => {
    await fetch(`/api/tickets/${ticket.ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED", completedBy: "DashboardUser" }),
    });
    onStatusChange?.();
  };

  return (
    <div className="p-4 border rounded-md shadow-sm bg-white">
      <div className="flex justify-between">
        <div>
          <div className="text-sm text-gray-500">{ticket.ticketId}</div>
          <div className="text-lg font-semibold">{ticket.description}</div>
          <div className="text-sm text-gray-600">Category: {ticket.category || "unknown"} • Priority: {ticket.priority}</div>
          <div className="text-sm text-gray-600">Location: {ticket.location || "-"}</div>
          <div className="text-xs text-gray-400">Created by: {ticket.createdBy || "-"}</div>
        </div>
        <div className="text-right">
          <div className={`px-2 py-1 rounded ${ticket.status === "PENDING" ? "bg-yellow-100" : "bg-green-100"}`}>
            {ticket.status}
          </div>
          <div className="mt-2">
            {ticket.photos?.length > 0 && ticket.photos.map((p: string) => (
              <img key={p} src={p} alt="photo" className="w-24 h-20 object-cover rounded mr-2" />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {ticket.status === "PENDING" && (
          <button onClick={markCompleted} className="px-3 py-1 bg-green-600 text-white rounded">Mark Completed</button>
        )}
      </div>
    </div>
  );
}
