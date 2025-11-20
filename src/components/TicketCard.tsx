// components/TicketCard.tsx
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

  return (
    <>
      <div className="p-4 border rounded-md shadow-sm bg-white">
        <div className="flex justify-between">
          <div className="flex-1">
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
          </div>
        </div>

        {/* Photos Section */}
        {ticket.photos?.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <div className="text-sm font-medium text-gray-700 mb-2">
              📸 Attached Photos ({ticket.photos.length})
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {ticket.photos.map((photo: string, index: number) => (
                <div
                  key={photo}
                  className="relative aspect-square cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <img
                    src={photo}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover rounded border border-gray-200"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          {ticket.status === "PENDING" && (
            <button onClick={markCompleted} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">
              Mark Completed
            </button>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              className="absolute top-2 right-2 bg-white rounded-full p-2 hover:bg-gray-100"
              onClick={() => setSelectedPhoto(null)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={selectedPhoto}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain rounded"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
