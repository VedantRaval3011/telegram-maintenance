"use client";
import React, { useState } from "react";

interface Note {
  content: string;
  createdBy: string;
  createdAt: Date | string;
}

export default function TicketCard({ ticket, onStatusChange }: { ticket: any; onStatusChange?: () => void }) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [notes, setNotes] = useState<Note[]>(ticket.notes || []);
  const [newNote, setNewNote] = useState("");

  const [editForm, setEditForm] = useState({
    description: ticket.description || "",
    category: ticket.category || "",
    priority: ticket.priority || "medium",
    location: ticket.location || "",
    status: ticket.status || "PENDING",
  });

  // Priority color mapping
  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "#ef4444"; // Red
      case "medium":
        return "#f59e0b"; // Orange
      case "low":
        return "#10b981"; // Green
      default:
        return "#9ca3af"; // Gray
    }
  };

  const priorityColor = getPriorityColor(ticket.priority);

  const markCompleted = async () => {
    await fetch(`/api/tickets/${ticket.ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED", completedBy: "DashboardUser" }),
    });
    onStatusChange?.();
  };

  const handleEdit = async () => {
    const response = await fetch(`/api/tickets/${ticket._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });

    if (response.ok) {
      setShowEditModal(false);
      onStatusChange?.();
    }
  };

  const handleDelete = async () => {
    const response = await fetch(`/api/tickets/${ticket._id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setShowDeleteConfirm(false);
      onStatusChange?.();
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    const response = await fetch(`/api/tickets/${ticket._id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: newNote,
        createdBy: "Dashboard User",
      }),
    });

    if (response.ok) {
      const data = await response.json();
      setNotes([...notes, data.data]);
      setNewNote("");
    }
  };

  const handleDeleteNote = async (index: number) => {
    const response = await fetch(`/api/tickets/${ticket._id}/notes?index=${index}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setNotes(notes.filter((_, i) => i !== index));
    }
  };

  const statusClass = () => {
    const base = "px-2 py-1 rounded-md text-xs font-semibold border";
    if (!ticket.status) return `${base} bg-[#b8a293] text-[#2c2420] border-[#c9b6a5]`;
    if (ticket.status === "PENDING") return `${base} bg-[#c9b6a5] text-[#2c2420] border-[#7d6856]`;
    if (ticket.status === "COMPLETED") return `${base} bg-[#7d6856] text-[#f5ebe0] border-[#5c4a3d]`;
    return `${base} bg-[#d4c0ae] text-[#2c2420] border-[#b8a293]`;
  };

  const getPriorityBadgeClass = (priority: string) => {
    const base = "px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1";
    switch (priority?.toLowerCase()) {
      case "high":
        return `${base} bg-red-50 text-red-700 border-red-300`;
      case "medium":
        return `${base} bg-amber-50 text-amber-700 border-amber-300`;
      case "low":
        return `${base} bg-emerald-50 text-emerald-700 border-emerald-300`;
      default:
        return `${base} bg-gray-50 text-gray-700 border-gray-300`;
    }
  };

  return (
    <>
      <div
        className="bg-[#f5ebe0] border border-[#c9b6a5] rounded-xl shadow-lg overflow-hidden"
        style={{ borderLeftWidth: '4px', borderLeftColor: priorityColor }}
      >
        {/* Header Section */}
        <div
          className="px-4 py-2.5 border-b border-[#c9b6a5]"
          style={{ backgroundColor: `${priorityColor}08` }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Ticket ID */}
              <span className="text-base font-black text-[#2c2420]">
                {ticket.ticketId}
              </span>

              {/* Priority Badge */}
              <span className={getPriorityBadgeClass(ticket.priority)}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: priorityColor }}></span>
                {ticket.priority?.toUpperCase() || "MED"}
              </span>

              {/* Status */}
              <span className={statusClass()}>{ticket.status}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowEditModal(true)}
                className="px-2 py-1 bg-[#ede0d1] text-[#2c2420] rounded hover:bg-[#d4c0ae] transition-all text-xs"
              >
                ✏️
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-2 py-1 bg-[#b8a293] text-[#2c2420] rounded hover:bg-[#7d6856] hover:text-[#f5ebe0] transition-all text-xs"
              >
                🗑️
              </button>
              {ticket.status !== "COMPLETED" && (
                <button
                  onClick={markCompleted}
                  className="px-2 py-1 bg-[#2c2420] text-[#f5ebe0] rounded hover:opacity-95 transition-all text-xs"
                >
                  ✓
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-4">
          {/* Description */}
          <h3 className="text-base font-semibold text-[#2c2420] mb-2 line-clamp-2">
            {ticket.description}
          </h3>

          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm mb-3">
            <span className="inline-flex items-center gap-1 text-[#5c4a3d]">
              <span className="font-semibold">Category:</span>
              <span className="px-1.5 py-0.5 bg-[#d4c0ae] rounded text-[#2c2420] font-medium">
                {ticket.category || "unknown"}
              </span>
            </span>

            {ticket.subCategory && (
              <span className="text-[#5c4a3d]">
                • <span className="font-medium">{ticket.subCategory}</span>
              </span>
            )}

            {/* Location - show source/target for transfer category */}
            {ticket.sourceLocation && ticket.targetLocation ? (
              <>
                <span className="text-[#5c4a3d]">
                  📤 <span className="font-medium">From: {ticket.sourceLocation}</span>
                </span>
                <span className="text-[#5c4a3d]">
                  📥 <span className="font-medium">To: {ticket.targetLocation}</span>
                </span>
              </>
            ) : (
              <span className="text-[#5c4a3d]">
                📍 <span className="font-medium">{ticket.location || "-"}</span>
              </span>
            )}

            {/* Agency Info */}
            {ticket.agencyName && (
              <span className="text-[#5c4a3d]">
                👷 <span className="font-medium">{ticket.agencyName}</span>
                {ticket.agencyDate && (
                  <span className="ml-1">
                    📅 {new Date(ticket.agencyDate).toLocaleDateString()}
                  </span>
                )}
                {ticket.agencyTime && (
                  <span className="ml-1">⏰ {ticket.agencyTime}</span>
                )}
              </span>
            )}
          </div>

          {/* Time and People Info */}
          <div className="bg-[#ede0d1] rounded-lg p-3 mb-3 grid grid-cols-3 gap-3 text-sm">
            {/* Created By */}
            <div>
              <div className="text-[10px] font-semibold text-[#7d6856] uppercase mb-0.5">
                👤 Created By
              </div>
              <div className="font-bold text-[#2c2420] truncate">
                {ticket.createdBy || "-"}
              </div>
              <div className="text-[10px] text-[#7d6856]">
                {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ""}
              </div>
            </div>

            {/* Time */}
            <div>
              <div className="text-[10px] font-semibold text-[#7d6856] uppercase mb-0.5">
                🕐 Time
              </div>
              <div className="font-bold text-[#2c2420]">
                {ticket.createdAt
                  ? `${Math.floor((Date.now() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60))}h ago`
                  : "-"
                }
              </div>
              <div className="text-[10px] text-[#7d6856]">
                {ticket.createdAt ? new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
              </div>
            </div>

            {/* Completed By */}
            {ticket.status === "COMPLETED" && ticket.completedBy ? (
              <div className="bg-[#7d6856]/10 -m-3 p-3 rounded-lg">
                <div className="text-[10px] font-semibold text-[#5c4a3d] uppercase mb-0.5">
                  ✅ Completed By
                </div>
                <div className="font-bold text-[#2c2420] truncate">
                  {ticket.completedBy}
                </div>
                <div className="text-[10px] text-[#7d6856]">
                  {ticket.completedAt ? new Date(ticket.completedAt).toLocaleDateString() : ""}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <span className="text-[10px] text-[#7d6856] italic">Not completed</span>
              </div>
            )}
          </div>

          {/* Photos */}
          {ticket.photos && ticket.photos.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] text-[#7d6856] font-semibold mb-1.5 uppercase">
                📸 Photos ({ticket.photos.length})
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {ticket.photos.map((url: string, idx: number) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`Photo ${idx + 1}`}
                    className="w-16 h-16 object-cover rounded border border-[#c9b6a5] cursor-pointer hover:opacity-80 transition"
                    onClick={() => setSelectedPhoto(url)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completion Photos */}
          {ticket.completionPhotos && ticket.completionPhotos.length > 0 && (
            <div className="mb-3 p-2.5 bg-[#d4c0ae] rounded-lg">
              <div className="text-[10px] text-[#2c2420] font-semibold mb-1.5 uppercase">
                ✅ After-fix Photos ({ticket.completionPhotos.length})
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {ticket.completionPhotos.map((url: string, idx: number) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`Completion ${idx + 1}`}
                    className="w-16 h-16 object-cover rounded border border-[#7d6856] cursor-pointer hover:opacity-80 transition"
                    onClick={() => setSelectedPhoto(url)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Notes Section */}
          <div className="pt-3 border-t border-[#c9b6a5]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-[#2c2420]">📝 Notes ({notes.length})</h3>
              <button
                onClick={() => setShowNotesModal(true)}
                className="px-2 py-0.5 bg-[#ede0d1] text-[#2c2420] rounded hover:bg-[#d4c0ae] transition-all text-[10px] font-medium"
              >
                + Add
              </button>
            </div>

            {notes.length > 0 ? (
              <div className="space-y-1.5">
                {notes.map((note, idx) => (
                  <div key={idx} className="bg-[#ede0d1] p-2 rounded">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#2c2420] line-clamp-2">{note.content}</p>
                        <p className="text-[10px] text-[#7d6856] mt-0.5 truncate">
                          {note.createdBy} • {new Date(note.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteNote(idx)}
                        className="text-[#7d6856] hover:text-[#2c2420] text-xs flex-shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-[#7d6856] italic">No notes yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={() => setShowEditModal(false)}>
          <div className="absolute inset-0 bg-[#2c2420]/80" />
          <div className="relative max-w-2xl w-full bg-[#f5ebe0] border border-[#c9b6a5] rounded-2xl p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-[#2c2420] mb-6">Edit Ticket</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#5c4a3d] mb-2">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-[#ede0d1] border border-[#c9b6a5] text-[#2c2420] rounded-xl outline-none focus:ring-2 focus:ring-[#7d6856]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#5c4a3d] mb-2">Category</label>
                  <input
                    type="text"
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full px-4 py-2 bg-[#ede0d1] border border-[#c9b6a5] text-[#2c2420] rounded-xl outline-none focus:ring-2 focus:ring-[#7d6856]/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#5c4a3d] mb-2">Priority</label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                    className="w-full px-4 py-2 bg-[#ede0d1] border border-[#c9b6a5] text-[#2c2420] rounded-xl outline-none focus:ring-2 focus:ring-[#7d6856]/20"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#5c4a3d] mb-2">Location</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full px-4 py-2 bg-[#ede0d1] border border-[#c9b6a5] text-[#2c2420] rounded-xl outline-none focus:ring-2 focus:ring-[#7d6856]/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#5c4a3d] mb-2">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-4 py-2 bg-[#ede0d1] border border-[#c9b6a5] text-[#2c2420] rounded-xl outline-none focus:ring-2 focus:ring-[#7d6856]/20"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-2 bg-[#e8d5c4] text-[#2c2420] rounded-xl font-medium hover:bg-[#d4c0ae] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEdit}
                  className="px-6 py-2 bg-[#2c2420] text-[#f5ebe0] rounded-xl shadow-lg hover:opacity-95 transition-all font-bold"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={() => setShowNotesModal(false)}>
          <div className="absolute inset-0 bg-[#2c2420]/80" />
          <div className="relative max-w-lg w-full bg-[#f5ebe0] border border-[#c9b6a5] rounded-2xl p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-[#2c2420] mb-6">Add Note</h2>

            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Enter your note..."
              rows={4}
              className="w-full px-4 py-2 bg-[#ede0d1] border border-[#c9b6a5] text-[#2c2420] rounded-xl outline-none focus:ring-2 focus:ring-[#7d6856]/20"
            />

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNotesModal(false)}
                className="px-6 py-2 bg-[#e8d5c4] text-[#2c2420] rounded-xl font-medium hover:bg-[#d4c0ae] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNote}
                className="px-6 py-2 bg-[#2c2420] text-[#f5ebe0] rounded-xl shadow-lg hover:opacity-95 transition-all font-bold"
              >
                Add Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={() => setShowDeleteConfirm(false)}>
          <div className="absolute inset-0 bg-[#2c2420]/80" />
          <div className="relative max-w-md w-full bg-[#f5ebe0] border border-[#c9b6a5] rounded-2xl p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-[#2c2420] mb-4">Delete Ticket?</h2>
            <p className="text-sm text-[#5c4a3d] mb-6">
              This will permanently delete the ticket and its Telegram message. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-6 py-2 bg-[#e8d5c4] text-[#2c2420] rounded-xl font-medium hover:bg-[#d4c0ae] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-6 py-2 bg-[#7d6856] text-[#f5ebe0] rounded-xl shadow-lg hover:opacity-95 transition-all font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#2c2420]/90" onClick={() => setSelectedPhoto(null)}>
          <img src={selectedPhoto} alt="Full size" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
      )}
    </>
  );
}
