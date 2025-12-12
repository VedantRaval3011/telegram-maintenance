"use client";
import React, { useState } from "react";
import {
  Edit2,
  Trash2,
  Check,
  User,
  Clock,
  MapPin,
  Camera,
  Video,
  FileText,
  Plus,
  X,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Building2,
  Calendar,
  Timer,
  RotateCcw
} from "lucide-react";

interface Note {
  content: string;
  createdBy: string;
  createdAt: Date | string;
}

// Helper function to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : null;
}

// Helper function to create a lighter version of a color
function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * percent));
  const g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * percent));
  const b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * percent));

  return `rgb(${r}, ${g}, ${b})`;
}

// Helper function to create a darker version of a color
function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const r = Math.max(0, Math.floor(rgb.r * (1 - percent)));
  const g = Math.max(0, Math.floor(rgb.g * (1 - percent)));
  const b = Math.max(0, Math.floor(rgb.b * (1 - percent)));

  return `rgb(${r}, ${g}, ${b})`;
}

export default function TicketCard({ ticket, onStatusChange, categoryColor, onScrollBack }: { ticket: any; onStatusChange?: () => void; categoryColor?: string; onScrollBack?: () => void }) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
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

  // Use category color or default to gray
  const baseColor = categoryColor || "#6b7280";

  // Generate color palette from the base color
  const colors = {
    bg: lightenColor(baseColor, 0.92),
    bgLight: lightenColor(baseColor, 0.95),
    border: lightenColor(baseColor, 0.7),
    borderDark: lightenColor(baseColor, 0.5),
    accent: baseColor,
    accentLight: lightenColor(baseColor, 0.85),
    accentMedium: lightenColor(baseColor, 0.75),
    text: darkenColor(baseColor, 0.7),
    textLight: darkenColor(baseColor, 0.4),
    textDark: darkenColor(baseColor, 0.85),
  };

  // Priority color mapping
  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "#ef4444"; // Red
      case "medium":
        return "#eab308"; // Yellow
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

  const reopenTicket = async () => {
    await fetch(`/api/tickets/${ticket.ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PENDING", reopen: true, reopenedBy: "DashboardUser" }),
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
    if (!ticket.status) return `${base} bg-gray-100 text-gray-700 border-gray-300`;
    if (ticket.status === "PENDING") return `${base} text-white`;
    if (ticket.status === "COMPLETED") return `${base} bg-emerald-100 text-emerald-700 border-emerald-300`;
    return `${base} bg-gray-100 text-gray-700 border-gray-300`;
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
        className="rounded-xl shadow-lg overflow-hidden"
        style={{
          backgroundColor: colors.bg,
          borderWidth: '1px',
          borderColor: colors.border,
          borderLeftWidth: '4px',
          borderLeftColor: priorityColor
        }}
      >
        {/* Header Section */}
        <div
          className="px-4 py-2.5"
          style={{
            backgroundColor: colors.accentLight,
            borderBottomWidth: '1px',
            borderBottomColor: colors.border
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Ticket ID */}
              <span className="text-base font-black" style={{ color: colors.textDark }}>
                {ticket.ticketId}
              </span>

              {/* Priority Badge */}
              <span className={getPriorityBadgeClass(ticket.priority)}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: priorityColor }}></span>
                {ticket.priority?.toUpperCase() || "MED"}
              </span>

              {/* Status */}
              <div className="flex items-center gap-1">
                <span
                  className={statusClass()}
                  style={ticket.status === "PENDING" ? { backgroundColor: colors.accent, borderColor: colors.borderDark } : {}}
                >
                  {ticket.status}
                </span>
                {onScrollBack && (
                  <button
                    onClick={() => onScrollBack()}
                    className="p-1 rounded-full hover:bg-black/10 transition-colors"
                    title="Scroll back to category"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-7 w-7"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      style={{ color: colors.textDark }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowEditModal(true)}
                className="px-2.5 py-1.5 rounded-lg hover:opacity-80 transition-all flex items-center gap-1"
                style={{ backgroundColor: colors.accentMedium, color: colors.textDark }}
                title="Edit ticket"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-2.5 py-1.5 rounded-lg hover:opacity-80 transition-all flex items-center gap-1"
                style={{ backgroundColor: colors.borderDark, color: colors.bgLight }}
                title="Delete ticket"
              >
                <Trash2 size={14} />
              </button>
              {ticket.status !== "COMPLETED" && (
                <button
                  onClick={markCompleted}
                  className="px-2.5 py-1.5 rounded-lg hover:opacity-95 transition-all text-white flex items-center gap-1"
                  style={{ backgroundColor: colors.textDark }}
                  title="Mark as completed"
                >
                  <Check size={14} />
                </button>
              )}
              {ticket.status === "COMPLETED" && (
                <button
                  onClick={reopenTicket}
                  className="px-2.5 py-1.5 rounded-lg hover:opacity-95 transition-all text-white flex items-center gap-1 bg-amber-500"
                  title="Reopen ticket"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-4">
          {/* Description */}
          <h3 className="text-base font-semibold mb-2 line-clamp-2" style={{ color: colors.textDark }}>
            {ticket.description}
          </h3>

          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm mb-3">
            <span className="inline-flex items-center gap-1" style={{ color: colors.text }}>
              <span className="font-semibold">Category:</span>
              <span
                className="px-1.5 py-0.5 rounded font-medium"
                style={{ backgroundColor: colors.accentMedium, color: colors.textDark }}
              >
                {ticket.category || "unknown"}
              </span>
            </span>

            {ticket.subCategory && (
              <span style={{ color: colors.text }}>
                • <span className="font-medium">{ticket.subCategory}</span>
              </span>
            )}

            {/* Location - show source/target for transfer category */}
            {ticket.sourceLocation && ticket.targetLocation ? (
              <>
                <span className="inline-flex items-center gap-1" style={{ color: colors.text }}>
                  <ArrowRight size={14} /> <span className="font-medium">From: {ticket.sourceLocation}</span>
                </span>
                <span className="inline-flex items-center gap-1" style={{ color: colors.text }}>
                  <ArrowLeft size={14} /> <span className="font-medium">To: {ticket.targetLocation}</span>
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1" style={{ color: colors.text }}>
                <MapPin size={14} /> <span className="font-medium">{ticket.location || "-"}</span>
              </span>
            )}

            {/* Agency Info */}
            {ticket.agencyName && (
              <span className="inline-flex items-center gap-1.5" style={{ color: colors.text }}>
                <Building2 size={14} /> <span className="font-medium">{ticket.agencyName}</span>
                {ticket.agencyDate && (
                  <span className="inline-flex items-center gap-1 ml-1">
                    <Calendar size={12} /> {new Date(ticket.agencyDate).toLocaleDateString()}
                  </span>
                )}
                {ticket.agencyTime && (
                  <span className="inline-flex items-center gap-1 ml-1"><Timer size={12} /> {ticket.agencyTime}</span>
                )}
              </span>
            )}
          </div>

          {/* Time and People Info */}
          <div
            className="rounded-lg p-3 mb-3 grid grid-cols-3 gap-3 text-sm"
            style={{ backgroundColor: colors.accentMedium }}
          >
            {/* Created By */}
            <div>
              <div className="text-[10px] font-semibold uppercase mb-0.5 flex items-center gap-1" style={{ color: colors.text }}>
                <User size={12} /> Created By
              </div>
              <div className="font-bold truncate" style={{ color: colors.textDark }}>
                {ticket.createdBy || "-"}
              </div>
              <div className="text-[10px]" style={{ color: colors.text }}>
                {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ""}
              </div>
            </div>

            {/* Time */}
            <div>
              <div className="text-[10px] font-semibold uppercase mb-0.5 flex items-center gap-1" style={{ color: colors.text }}>
                <Clock size={12} /> Time
              </div>
              <div className="font-bold" style={{ color: colors.textDark }}>
                {ticket.createdAt
                  ? `${Math.floor((Date.now() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60))}h ago`
                  : "-"
                }
              </div>
              <div className="text-[10px]" style={{ color: colors.text }}>
                {ticket.createdAt ? new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
              </div>
            </div>

            {/* Completed By */}
            {ticket.status === "COMPLETED" && ticket.completedBy ? (
              <div className="-m-3 p-3 rounded-lg" style={{ backgroundColor: `${colors.accent}20` }}>
                <div className="text-[10px] font-semibold uppercase mb-0.5 flex items-center gap-1" style={{ color: colors.textDark }}>
                  <CheckCircle2 size={12} /> Completed By
                </div>
                <div className="font-bold truncate" style={{ color: colors.textDark }}>
                  {ticket.completedBy}
                </div>
                <div className="text-[10px]" style={{ color: colors.text }}>
                  {ticket.completedAt ? new Date(ticket.completedAt).toLocaleDateString() : ""}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <span className="text-[10px] italic" style={{ color: colors.text }}>Not completed</span>
              </div>
            )}
          </div>

          {/* Photos */}
          {ticket.photos && ticket.photos.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] font-semibold mb-1.5 uppercase flex items-center gap-1" style={{ color: colors.text }}>
                <Camera size={12} /> Photos ({ticket.photos.length})
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {ticket.photos.map((url: string, idx: number) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`Photo ${idx + 1}`}
                    className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition"
                    style={{ borderWidth: '1px', borderColor: colors.border }}
                    onClick={() => setSelectedPhoto(url)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Videos */}
          {ticket.videos && ticket.videos.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] font-semibold mb-1.5 uppercase flex items-center gap-1" style={{ color: colors.text }}>
                <Video size={12} /> Videos ({ticket.videos.length})
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {ticket.videos.map((url: string, idx: number) => (
                  <div
                    key={idx}
                    className="w-24 h-16 rounded cursor-pointer hover:opacity-80 transition relative overflow-hidden"
                    style={{ borderWidth: '1px', borderColor: colors.border }}
                    onClick={() => setSelectedVideo(url)}
                  >
                    <video
                      src={url}
                      className="w-full h-full object-cover"
                      muted
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center">
                        <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-gray-800 border-b-[5px] border-b-transparent ml-0.5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completion Photos */}
          {ticket.completionPhotos && ticket.completionPhotos.length > 0 && (
            <div className="mb-3 p-2.5 rounded-lg" style={{ backgroundColor: colors.accentMedium }}>
              <div className="text-[10px] font-semibold mb-1.5 uppercase flex items-center gap-1" style={{ color: colors.textDark }}>
                <CheckCircle2 size={12} /> After-fix Photos ({ticket.completionPhotos.length})
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {ticket.completionPhotos.map((url: string, idx: number) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`Completion ${idx + 1}`}
                    className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition"
                    style={{ borderWidth: '1px', borderColor: colors.borderDark }}
                    onClick={() => setSelectedPhoto(url)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completion Videos */}
          {ticket.completionVideos && ticket.completionVideos.length > 0 && (
            <div className="mb-3 p-2.5 rounded-lg" style={{ backgroundColor: colors.accentMedium }}>
              <div className="text-[10px] font-semibold mb-1.5 uppercase flex items-center gap-1" style={{ color: colors.textDark }}>
                <Video size={12} /> After-fix Videos ({ticket.completionVideos.length})
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {ticket.completionVideos.map((url: string, idx: number) => (
                  <div
                    key={idx}
                    className="w-24 h-16 rounded cursor-pointer hover:opacity-80 transition relative overflow-hidden"
                    style={{ borderWidth: '1px', borderColor: colors.borderDark }}
                    onClick={() => setSelectedVideo(url)}
                  >
                    <video
                      src={url}
                      className="w-full h-full object-cover"
                      muted
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center">
                        <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-gray-800 border-b-[5px] border-b-transparent ml-0.5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes Section */}
          <div className="pt-3" style={{ borderTopWidth: '1px', borderTopColor: colors.border }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold flex items-center gap-1" style={{ color: colors.textDark }}>
                <FileText size={14} /> Notes ({notes.length})
              </h3>
              <button
                onClick={() => setShowNotesModal(true)}
                className="px-2 py-1 rounded-lg hover:opacity-80 transition-all text-[10px] font-medium flex items-center gap-1"
                style={{ backgroundColor: colors.accentMedium, color: colors.textDark }}
              >
                <Plus size={12} /> Add
              </button>
            </div>

            {notes.length > 0 ? (
              <div className="space-y-1.5">
                {notes.map((note, idx) => (
                  <div key={idx} className="p-2 rounded" style={{ backgroundColor: colors.accentMedium }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs line-clamp-2" style={{ color: colors.textDark }}>{note.content}</p>
                        <p className="text-[10px] mt-0.5 truncate" style={{ color: colors.text }}>
                          {note.createdBy} • {new Date(note.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteNote(idx)}
                        className="text-xs flex-shrink-0 hover:opacity-70 p-0.5"
                        style={{ color: colors.text }}
                        title="Delete note"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] italic" style={{ color: colors.text }}>No notes yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={() => setShowEditModal(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative max-w-2xl w-full rounded-2xl p-8 shadow-xl"
            style={{ backgroundColor: colors.bg, borderWidth: '1px', borderColor: colors.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-6" style={{ color: colors.textDark }}>Edit Ticket</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 rounded-xl outline-none focus:ring-2"
                  style={{
                    backgroundColor: colors.accentMedium,
                    borderWidth: '1px',
                    borderColor: colors.border,
                    color: colors.textDark
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>Category</label>
                  <input
                    type="text"
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.accentMedium,
                      borderWidth: '1px',
                      borderColor: colors.border,
                      color: colors.textDark
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>Priority</label>
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.accentMedium,
                      borderWidth: '1px',
                      borderColor: colors.border,
                      color: colors.textDark
                    }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>Location</label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.accentMedium,
                      borderWidth: '1px',
                      borderColor: colors.border,
                      color: colors.textDark
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.accentMedium,
                      borderWidth: '1px',
                      borderColor: colors.border,
                      color: colors.textDark
                    }}
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
                  className="px-6 py-2 rounded-xl font-medium hover:opacity-80 transition-all"
                  style={{ backgroundColor: colors.accentMedium, color: colors.textDark }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEdit}
                  className="px-6 py-2 rounded-xl shadow-lg hover:opacity-95 transition-all font-bold text-white"
                  style={{ backgroundColor: colors.textDark }}
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
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative max-w-lg w-full rounded-2xl p-8 shadow-xl"
            style={{ backgroundColor: colors.bg, borderWidth: '1px', borderColor: colors.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-6" style={{ color: colors.textDark }}>Add Note</h2>

            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Enter your note..."
              rows={4}
              className="w-full px-4 py-2 rounded-xl outline-none focus:ring-2"
              style={{
                backgroundColor: colors.accentMedium,
                borderWidth: '1px',
                borderColor: colors.border,
                color: colors.textDark
              }}
            />

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNotesModal(false)}
                className="px-6 py-2 rounded-xl font-medium hover:opacity-80 transition-all"
                style={{ backgroundColor: colors.accentMedium, color: colors.textDark }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddNote}
                className="px-6 py-2 rounded-xl shadow-lg hover:opacity-95 transition-all font-bold text-white"
                style={{ backgroundColor: colors.textDark }}
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
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative max-w-md w-full rounded-2xl p-8 shadow-xl"
            style={{ backgroundColor: colors.bg, borderWidth: '1px', borderColor: colors.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-4" style={{ color: colors.textDark }}>Delete Ticket?</h2>
            <p className="text-sm mb-6" style={{ color: colors.text }}>
              This will permanently delete the ticket and its Telegram message. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-6 py-2 rounded-xl font-medium hover:opacity-80 transition-all"
                style={{ backgroundColor: colors.accentMedium, color: colors.textDark }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-6 py-2 bg-red-500 text-white rounded-xl shadow-lg hover:bg-red-600 transition-all font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90" onClick={() => setSelectedPhoto(null)}>
          <img src={selectedPhoto} alt="Full size" className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
      )}

      {/* Video Lightbox */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90" onClick={() => setSelectedVideo(null)}>
          <video
            src={selectedVideo}
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            controls
            autoPlay
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
