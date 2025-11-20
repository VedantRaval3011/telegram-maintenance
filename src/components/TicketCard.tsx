"use client";
import React, { useState } from "react";

export default function TicketCard({ ticket, onStatusChange }: { ticket: any, onStatusChange?: () => void }) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const markCompleted = async () => {
    await fetch(`/api/tickets/${ticket.ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED", completedBy: "DashboardUser" }),
    });
    onStatusChange?.();
  };

  const statusClass = () => {
    if (!ticket.status) return "badge";
    if (ticket.status === "PENDING") return "badge badge-pending";
    if (ticket.status === "COMPLETED") return "badge badge-completed";
    return "badge badge-inprogress";
  };

  return (
    <>
      <div className="card-soft flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs text-gray-400">{ticket.ticketId}</div>
              <div className="mt-1 text-lg font-semibold text-gray-900 truncate">{ticket.description}</div>
              <div className="mt-2 text-sm text-gray-600">
                <span className="inline-block mr-2">Category: <span className="font-medium text-gray-800">{ticket.category || "unknown"}</span></span>
                <span className="inline-block mr-2">• Priority: <span className="font-medium">{ticket.priority}</span></span>
                <span className="inline-block">• Location: <span className="font-medium">{ticket.location || "-"}</span></span>
              </div>
              <div className="mt-2 text-xs text-gray-400">Created by: {ticket.createdBy || "-"}</div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className={statusClass()}>{ticket.status}</div>
              <div className="text-xs text-gray-400">{ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : ""}</div>
            </div>
          </div>

          {/* Photos Section */}
          {ticket.photos?.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <div className="text-sm font-medium text-gray-700 mb-3">
                📸 Attached Photos <span className="text-xs text-gray-400">({ticket.photos.length})</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {ticket.photos.map((photo: string, index: number) => (
                  <button
                    key={photo}
                    className="relative aspect-square rounded overflow-hidden group"
                    onClick={() => setSelectedPhoto(photo)}
                    aria-label={`Open photo ${index + 1}`}
                  >
                    <img
                      src={photo}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-150"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-full md:w-44 flex md:flex-col items-center md:items-end gap-3">
          <div className="w-full flex items-center justify-end">
            {ticket.status === "PENDING" && (
              <button onClick={markCompleted} className="w-full md:w-auto px-4 py-2 bg-gradient-to-r from-teal-500 to-indigo-600 text-white rounded-lg shadow hover:opacity-95">
                Mark Completed
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          aria-modal="true"
          role="dialog"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative max-w-4xl w-full max-h-[90vh] hero-glass p-4">
            <button
              className="absolute top-3 right-3 bg-white rounded-full p-2 hover:bg-gray-100 z-10"
              onClick={() => setSelectedPhoto(null)}
              aria-label="Close"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center justify-center">
              <img
                src={selectedPhoto}
                alt="Full size"
                className="max-w-full max-h-[80vh] object-contain rounded"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
