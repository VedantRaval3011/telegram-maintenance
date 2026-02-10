"use client";
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
  RotateCcw,
  EyeOff,
  Eye,
  Share2,
  MessageCircle,
  Send,
  Copy,
  Phone,
  Activity,
  History,
  ArrowUpCircle,
  FileSearch,
  Monitor,
  MessageSquare,
  File,
  Download,
  ExternalLink
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

// Helper function to determine if user is from Telegram or Dashboard
const getUserType = (username: string): "telegram" | "dashboard" | "system" => {
  if (!username || username === "Unknown") return "system";
  if (username.toLowerCase() === "system") return "system";
  // Dashboard users typically have structured usernames (admin, user1, etc.)
  // Telegram users often have display names with spaces or special characters
  if (username.includes(" ") || username.match(/[^\w\s]/)) return "telegram";
  return "dashboard";
};

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

export default function TicketCard({ 
  ticket, 
  onStatusChange, 
  categoryColor, 
  onScrollBack, 
  onEditClick,
  onExcludeFromSummary,
  isExcludedFromSummary,
  // Access control props
  isReadOnly = false,
  hideTimeDetails = false,
  // Custom actions
  onUnassign,
  isAdmin,
  customActions
}: { 
  ticket: any; 
  onStatusChange?: () => void; 
  categoryColor?: string; 
  onScrollBack?: () => void; 
  onEditClick?: () => void;
  onExcludeFromSummary?: () => void;
  isExcludedFromSummary?: boolean;
  // Access control
  isReadOnly?: boolean;
  hideTimeDetails?: boolean;
  // Custom actions
  onUnassign?: (ticketId: string) => void;
  isAdmin?: boolean;
  customActions?: React.ReactNode;
}) {
  const { user: authUser } = useAuth();
  const currentUsername = authUser?.displayName || authUser?.username || "Dashboard User";
  
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
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
      body: JSON.stringify({ status: "COMPLETED", completedBy: currentUsername }),
    });
    onStatusChange?.();
  };

  const reopenTicket = async () => {
    const reason = prompt("Please enter the reason for reopening this ticket:");
    if (reason === null) return; // User cancelled
    
    const url = `/api/tickets/${ticket._id || ticket.ticketId}`;
    alert(`DEBUG: Fetching URL: ${url}`);
    
    const response = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        status: "PENDING", 
        reopen: true, 
        reopenedBy: currentUsername,
        reopenedReason: reason || "Not specified"
      }),
    });
    
    if (response.ok) {
      onStatusChange?.();
    } else {
      const errData = await response.json();
      alert(`Failed to reopen ticket: ${errData.error || "Unknown error"}`);
    }
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
        createdBy: currentUsername,
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
          borderStyle: 'solid',
          borderTopWidth: '1px',
          borderRightWidth: '1px',
          borderBottomWidth: '1px',
          borderLeftWidth: '4px',
          borderTopColor: colors.border,
          borderRightColor: colors.border,
          borderBottomColor: colors.border,
          borderLeftColor: priorityColor
        }}
      >
        {/* Header Section */}
        <div
          className="px-3 py-2"
          style={{
            backgroundColor: colors.accentLight,
            borderBottomWidth: '1px',
            borderBottomColor: colors.border
          }}
        >
          {/* Row 1: Ticket Info */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              {/* Ticket ID */}
              <span className="text-sm font-black" style={{ color: colors.textDark }}>
                {ticket.ticketId}
              </span>

              {/* Priority Badge */}
              <span className={getPriorityBadgeClass(ticket.priority)}>
                <span className="w-1 h-1 rounded-full" style={{ backgroundColor: priorityColor }}></span>
                {ticket.priority?.toUpperCase() || "MED"}
              </span>

              {/* Status */}
              <span
                className={statusClass()}
                style={ticket.status === "PENDING" ? { backgroundColor: colors.accent, borderColor: colors.borderDark } : {}}
              >
                {ticket.status}
              </span>

              {ticket.reopenedHistory && ticket.reopenedHistory.length > 0 && (
                <span 
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-300"
                  title={`This ticket was reopened ${ticket.reopenedHistory.length} time(s)`}
                >
                  <RotateCcw size={10} /> REOPENED {ticket.reopenedHistory.length > 1 ? `(${ticket.reopenedHistory.length})` : ''}
                </span>
              )}
              
              {onScrollBack && (
                <button
                  onClick={() => onScrollBack()}
                  className="p-1 rounded-full hover:bg-black/10 transition-colors"
                  title="Scroll back to category"
                >
                  <ArrowUpCircle size={18} style={{ color: colors.textDark }} />
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAuditModal(true);
                }}
                className="p-1 rounded-full hover:bg-black/10 transition-colors"
                title="View ticket audit insights"
              >
                <Activity size={18} style={{ color: colors.textDark }} />
              </button>
            </div>

            {/* Action Buttons - Compact icon-only buttons */}
            {!isReadOnly && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {customActions}
                <button
                  onClick={() => onEditClick ? onEditClick() : setShowEditModal(true)}
                  className="p-1.5 rounded-md hover:opacity-80 transition-all"
                  style={{ backgroundColor: colors.accentMedium, color: colors.textDark }}
                  title="Edit ticket"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1.5 rounded-md hover:opacity-80 transition-all"
                  style={{ backgroundColor: colors.borderDark, color: colors.bgLight }}
                  title="Delete ticket"
                >
                  <Trash2 size={12} />
                </button>
                <button
                  onClick={() => setShowShareModal(true)}
                  className="p-1.5 rounded-md hover:opacity-80 transition-all"
                  style={{ backgroundColor: '#f97316', color: 'white' }}
                  title="Share ticket"
                >
                  <Share2 size={12} />
                </button>
                {ticket.status !== "COMPLETED" && (
                  <button
                    onClick={markCompleted}
                    className="p-1.5 rounded-md hover:opacity-95 transition-all text-white"
                    style={{ backgroundColor: colors.textDark }}
                    title="Mark as completed"
                  >
                    <Check size={12} />
                  </button>
                )}
                {ticket.status === "COMPLETED" && (
                  <button
                    onClick={reopenTicket}
                    className="p-1.5 rounded-md hover:opacity-95 transition-all text-white bg-amber-500"
                    title="Reopen ticket"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>
            )}
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
            {ticket.agencyName && !["NONE", "__NONE__", "null"].includes(ticket.agencyName) && ticket.agencyName.trim() !== "" ? (
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
            ) : (
              <span className="inline-flex items-center gap-1.5 opacity-60 italic text-[10px]" style={{ color: colors.text }}>
                <Building2 size={14} /> Agency: Not Assigned
              </span>
            )}
          </div>

          {/* Time and People Info - Conditionally hide time details */}
          <div
            className="rounded-lg p-3 mb-3 grid grid-cols-3 gap-3 text-sm"
            style={{ backgroundColor: colors.accentMedium }}
          >
            {/* Created By */}
            <div>
              <div className="text-[10px] font-semibold uppercase mb-0.5 flex items-center gap-1" style={{ color: colors.text }}>
                <User size={12} /> Created By
              </div>
              <div className="font-bold truncate flex items-center gap-1.5" style={{ color: colors.textDark }}>
                {ticket.createdBy || "-"}
                {ticket.createdBy && getUserType(ticket.createdBy) !== "system" && (
                  <span 
                    className="inline-flex items-center justify-center p-0.5 rounded shadow-sm flex-shrink-0"
                    title={getUserType(ticket.createdBy) === 'telegram' ? 'Telegram' : 'Dashboard'}
                    style={{
                      backgroundColor: getUserType(ticket.createdBy) === 'telegram' ? '#dbeafe' : '#f3e8ff',
                      color: getUserType(ticket.createdBy) === 'telegram' ? '#1d4ed8' : '#7e22ce',
                    }}
                  >
                    {getUserType(ticket.createdBy) === 'telegram' ? <MessageSquare size={10} /> : <Monitor size={10} />}
                  </span>
                )}
              </div>
              {!hideTimeDetails && (
                <div className="text-[10px]" style={{ color: colors.text }}>
                  {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ""}
                </div>
              )}
            </div>

            {/* Time - Hidden when hideTimeDetails is true */}
            {!hideTimeDetails ? (
              <div>
                <div className="text-[10px] font-semibold uppercase mb-0.5 flex items-center gap-1" style={{ color: colors.text }}>
                  <Clock size={12} /> Time
                </div>
                <div className="font-bold whitespace-nowrap" style={{ color: colors.textDark }}>
                  {ticket.createdAt ? (() => {
                    const creationTime = new Date(ticket.createdAt).getTime();
                    
                    // Use current completion time if COMPLETED, else Now
                    const endTime = ticket.status === "COMPLETED" && ticket.completedAt 
                      ? new Date(ticket.completedAt).getTime() 
                      : Date.now();

                    // Calculate total inactive time (periods when it was COMPLETED)
                    let totalInactiveMs = 0;
                    if (ticket.reopenedHistory && ticket.reopenedHistory.length > 0) {
                      ticket.reopenedHistory.forEach((h: any) => {
                        if (h.reopenedAt && h.previousCompletedAt) {
                          const start = new Date(h.previousCompletedAt).getTime();
                          const end = new Date(h.reopenedAt).getTime();
                          if (end > start) {
                            totalInactiveMs += (end - start);
                          }
                        }
                      });
                    }

                    const activeMs = Math.max(0, endTime - creationTime - totalInactiveMs);
                    const hoursExact = activeMs / (1000 * 60 * 60);
                    const hoursRounded = Math.floor(hoursExact);
                    
                    if (hoursRounded >= 24) {
                      const daysDecimal = (hoursExact / 24).toFixed(1);
                      return `${daysDecimal}d ago (${hoursRounded}h)`;
                    }
                    return `${hoursRounded}h ago`;
                  })() : "-"}
                </div>
                <div className="text-[10px]" style={{ color: colors.text }}>
                  {ticket.createdAt ? new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <span className="text-[10px] italic text-slate-400">Time hidden</span>
              </div>
            )}

            {/* Assigned To or Completed By */}
            {ticket.status === "COMPLETED" && ticket.completedBy ? (
              <div className="-m-3 p-3 rounded-lg" style={{ backgroundColor: `${colors.accent}20` }}>
                <div className="text-[10px] font-semibold uppercase mb-0.5 flex items-center gap-1" style={{ color: colors.textDark }}>
                  <CheckCircle2 size={12} /> Completed By
                </div>
                <div className="font-bold truncate flex items-center gap-1.5" style={{ color: colors.textDark }}>
                  {ticket.completedBy}
                  {ticket.completedBy && getUserType(ticket.completedBy) !== "system" && (
                    <span 
                      className="inline-flex items-center justify-center p-0.5 rounded shadow-sm flex-shrink-0"
                      title={getUserType(ticket.completedBy) === 'telegram' ? 'Telegram' : 'Dashboard'}
                      style={{
                        backgroundColor: getUserType(ticket.completedBy) === 'telegram' ? '#dbeafe' : '#f3e8ff',
                        color: getUserType(ticket.completedBy) === 'telegram' ? '#1d4ed8' : '#7e22ce',
                      }}
                    >
                      {getUserType(ticket.completedBy) === 'telegram' ? <MessageSquare size={10} /> : <Monitor size={10} />}
                    </span>
                  )}
                </div>
                {!hideTimeDetails && (
                  <div className="text-[10px]" style={{ color: colors.text }}>
                    {ticket.completedAt ? new Date(ticket.completedAt).toLocaleDateString() : ""}
                  </div>
                )}
              </div>
            ) : ticket.assignedTo ? (
              <div className="-m-3 p-3 rounded-lg" style={{ backgroundColor: `${colors.accent}20` }}>
                <div className="text-[10px] font-semibold uppercase mb-0.5 flex items-center gap-1" style={{ color: colors.textDark }}>
                  <User size={12} /> Assigned To
                </div>
                <div className="font-bold truncate" style={{ color: colors.textDark }}>
                  {ticket.assignedTo.firstName || ticket.assignedTo.username || "Assigned"}
                </div>
                {ticket.assignedTo.phone && isAdmin && (
                  <div className="text-[10px] flex items-center gap-1" style={{ color: colors.text }}>
                    <Phone size={10} /> {ticket.assignedTo.phone}
                  </div>
                )}
                {onUnassign && isAdmin && (
                  <button 
                    onClick={() => onUnassign(ticket.ticketId)}
                    className="text-[10px] text-red-500 hover:text-red-700 font-medium mt-1 underline"
                  >
                    Unassign
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <span className="text-[10px] italic" style={{ color: colors.text }}>Unassigned</span>
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

          {/* Documents */}
          {ticket.documents && ticket.documents.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] font-semibold mb-1.5 uppercase flex items-center gap-1" style={{ color: colors.text }}>
                <FileText size={12} /> Documents ({ticket.documents.length})
              </div>
              <div className="flex flex-col gap-1.5">
                {ticket.documents.map((url: string, idx: number) => {
                  const fileName = url.split('/').pop()?.split('?')[0] || `Document ${idx + 1}`;
                  return (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded border border-dashed hover:bg-black/5 transition"
                      style={{ borderColor: colors.border }}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <File size={14} style={{ color: colors.text }} />
                        <span className="text-xs truncate font-medium" style={{ color: colors.textDark }}>{fileName}</span>
                      </div>
                      <Download size={12} style={{ color: colors.text }} />
                    </a>
                  );
                })}
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

          {/* Completion Documents */}
          {ticket.completionDocuments && ticket.completionDocuments.length > 0 && (
            <div className="mb-3 p-2.5 rounded-lg" style={{ backgroundColor: colors.accentMedium }}>
              <div className="text-[10px] font-semibold mb-1.5 uppercase flex items-center gap-1" style={{ color: colors.textDark }}>
                <CheckCircle2 size={12} /> After-fix Documents ({ticket.completionDocuments.length})
              </div>
              <div className="flex flex-col gap-1.5">
                {ticket.completionDocuments.map((url: string, idx: number) => {
                  const fileName = url.split('/').pop()?.split('?')[0] || `Document ${idx + 1}`;
                  return (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded border border-dashed hover:bg-black/5 transition shadow-sm bg-white/50"
                      style={{ borderColor: colors.borderDark }}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText size={14} style={{ color: colors.textDark }} />
                        <span className="text-xs truncate font-medium" style={{ color: colors.textDark }}>{fileName}</span>
                      </div>
                      <Download size={12} style={{ color: colors.textDark }} />
                    </a>
                  );
                })}
              </div>
            </div>
          )}


          {/* Notes Section */}
          <div className="pt-3" style={{ borderTopWidth: '1px', borderTopColor: colors.border }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold flex items-center gap-1" style={{ color: colors.textDark }}>
                <FileText size={14} /> Notes ({notes.length})
              </h3>
              <div className="flex items-center gap-1.5">
                {/* Exclude from Summary Button - Icon Only, Bottom Right */}
                {onExcludeFromSummary && (
                  <button
                    onClick={onExcludeFromSummary}
                    className={`p-1.5 rounded-lg transition-all hover:scale-110 shadow-sm ${
                      isExcludedFromSummary ? 'ring-2 ring-purple-400' : ''
                    }`}
                    style={{ 
                      backgroundColor: isExcludedFromSummary ? '#a855f7' : colors.accentMedium, 
                      color: isExcludedFromSummary ? 'white' : colors.textDark 
                    }}
                    title={isExcludedFromSummary ? "Include in summary calculations" : "Exclude from summary calculations"}
                  >
                    {isExcludedFromSummary ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                )}
                <button
                  onClick={() => setShowNotesModal(true)}
                  className="px-2 py-1 rounded-lg hover:opacity-80 transition-all text-[10px] font-medium flex items-center gap-1"
                  style={{ backgroundColor: colors.accentMedium, color: colors.textDark }}
                >
                  <Plus size={12} /> Add
                </button>
              </div>
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

      {/* Share Ticket Modal */}
      {showShareModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-xl">
                  <Share2 className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Share Ticket</h2>
                  <p className="text-sm text-gray-600">{ticket.ticketId}</p>
                </div>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6">
              {/* Message Preview */}
              <div className="mb-6">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Message Preview</label>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-48 overflow-y-auto text-sm text-gray-800 font-mono whitespace-pre-wrap">
                  {(() => {
                    const dateStr = ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";
                    let msg = `🎫 Ticket: ${ticket.ticketId}\n`;
                    msg += `📋 Status: ${ticket.status}\n`;
                    msg += `🔴 Priority: ${ticket.priority?.toUpperCase() || "MEDIUM"}\n\n`;
                    msg += `📝 Issue: ${ticket.description || "No description"}\n\n`;
                    if (ticket.category) {
                      msg += `📂 Category: ${ticket.category}${ticket.subCategory ? " → " + ticket.subCategory : ""}\n`;
                    }
                    msg += `📍 Location: ${ticket.location || "Not specified"}\n`;
                    if (ticket.agencyName && !["NONE", "__NONE__"].includes(ticket.agencyName)) {
                      msg += `🏢 Agency: ${ticket.agencyName}\n`;
                      if (ticket.agencyDate) {
                        msg += `📅 Scheduled: ${new Date(ticket.agencyDate).toLocaleDateString()}${ticket.agencyTime ? " at " + ticket.agencyTime : ""}\n`;
                      }
                    }
                    msg += `\n👤 Created By: ${ticket.createdBy || "Unknown"}\n`;
                    msg += `📅 Date: ${dateStr}\n`;
                    if (ticket.status === "COMPLETED" && ticket.completedBy) {
                      const completedDateStr = ticket.completedAt ? new Date(ticket.completedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
                      msg += `\n✅ Completed By: ${ticket.completedBy}${completedDateStr ? " on " + completedDateStr : ""}\n`;
                    }
                    if (ticket.photos && ticket.photos.length > 0) {
                      msg += `\n📷 Photos (${ticket.photos.length}):\n`;
                      ticket.photos.forEach((url: string) => { msg += `${url}\n`; });
                    }
                    if (ticket.videos && ticket.videos.length > 0) {
                      msg += `\n🎬 Videos (${ticket.videos.length}):\n`;
                      ticket.videos.forEach((url: string) => { msg += `${url}\n`; });
                    }
                    return msg;
                  })()}
                </div>
              </div>

              {/* Share Options */}
              <div className="space-y-3">
                {/* WhatsApp */}
                <button
                  onClick={() => {
                    const dateStr = ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";
                    let msg = `🎫 Ticket: ${ticket.ticketId}\n`;
                    msg += `📋 Status: ${ticket.status}\n`;
                    msg += `🔴 Priority: ${ticket.priority?.toUpperCase() || "MEDIUM"}\n\n`;
                    msg += `📝 Issue: ${ticket.description || "No description"}\n\n`;
                    if (ticket.category) {
                      msg += `📂 Category: ${ticket.category}${ticket.subCategory ? " → " + ticket.subCategory : ""}\n`;
                    }
                    msg += `📍 Location: ${ticket.location || "Not specified"}\n`;
                    if (ticket.agencyName && !["NONE", "__NONE__"].includes(ticket.agencyName)) {
                      msg += `🏢 Agency: ${ticket.agencyName}\n`;
                    }
                    msg += `\n👤 Created By: ${ticket.createdBy || "Unknown"}\n`;
                    msg += `📅 Date: ${dateStr}\n`;
                    if (ticket.status === "COMPLETED" && ticket.completedBy) {
                      const completedDateStr = ticket.completedAt ? new Date(ticket.completedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
                      msg += `\n✅ Completed By: ${ticket.completedBy}${completedDateStr ? " on " + completedDateStr : ""}\n`;
                    }
                    if (ticket.photos && ticket.photos.length > 0) {
                      msg += `\n📷 Photos (${ticket.photos.length}):\n`;
                      ticket.photos.forEach((url: string) => { msg += `${url}\n`; });
                    }
                    const encodedMessage = encodeURIComponent(msg);
                    window.open(`https://wa.me/?text=${encodedMessage}`, "_blank");
                  }}
                  className="w-full flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl transition-all group"
                >
                  <div className="p-2 bg-green-500 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-green-800">Share on WhatsApp</div>
                    <div className="text-xs text-green-600">Opens WhatsApp with message</div>
                  </div>
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Telegram */}
                <button
                  onClick={() => {
                    const dateStr = ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";
                    let msg = `🎫 Ticket: ${ticket.ticketId}\n`;
                    msg += `📋 Status: ${ticket.status}\n`;
                    msg += `🔴 Priority: ${ticket.priority?.toUpperCase() || "MEDIUM"}\n\n`;
                    msg += `📝 Issue: ${ticket.description || "No description"}\n\n`;
                    if (ticket.category) {
                      msg += `📂 Category: ${ticket.category}${ticket.subCategory ? " → " + ticket.subCategory : ""}\n`;
                    }
                    msg += `📍 Location: ${ticket.location || "Not specified"}\n`;
                    if (ticket.agencyName && !["NONE", "__NONE__"].includes(ticket.agencyName)) {
                      msg += `🏢 Agency: ${ticket.agencyName}\n`;
                    }
                    msg += `\n👤 Created By: ${ticket.createdBy || "Unknown"}\n`;
                    msg += `📅 Date: ${dateStr}\n`;
                    if (ticket.status === "COMPLETED" && ticket.completedBy) {
                      const completedDateStr = ticket.completedAt ? new Date(ticket.completedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
                      msg += `\n✅ Completed By: ${ticket.completedBy}${completedDateStr ? " on " + completedDateStr : ""}\n`;
                    }
                    if (ticket.photos && ticket.photos.length > 0) {
                      msg += `\n📷 Photos (${ticket.photos.length}):\n`;
                      ticket.photos.forEach((url: string) => { msg += `${url}\n`; });
                    }
                    const encodedMessage = encodeURIComponent(msg);
                    window.open(`https://t.me/share/url?text=${encodedMessage}`, "_blank");
                  }}
                  className="w-full flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all group"
                >
                  <div className="p-2 bg-blue-500 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                    <Send className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-blue-800">Share on Telegram</div>
                    <div className="text-xs text-blue-600">Opens Telegram with message</div>
                  </div>
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Copy */}
                <button
                  onClick={async () => {
                    const dateStr = ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";
                    let msg = `🎫 Ticket: ${ticket.ticketId}\n`;
                    msg += `📋 Status: ${ticket.status}\n`;
                    msg += `🔴 Priority: ${ticket.priority?.toUpperCase() || "MEDIUM"}\n\n`;
                    msg += `📝 Issue: ${ticket.description || "No description"}\n\n`;
                    if (ticket.category) {
                      msg += `📂 Category: ${ticket.category}${ticket.subCategory ? " → " + ticket.subCategory : ""}\n`;
                    }
                    msg += `📍 Location: ${ticket.location || "Not specified"}\n`;
                    if (ticket.agencyName && !["NONE", "__NONE__"].includes(ticket.agencyName)) {
                      msg += `🏢 Agency: ${ticket.agencyName}\n`;
                    }
                    msg += `\n👤 Created By: ${ticket.createdBy || "Unknown"}\n`;
                    msg += `📅 Date: ${dateStr}\n`;
                    if (ticket.status === "COMPLETED" && ticket.completedBy) {
                      const completedDateStr = ticket.completedAt ? new Date(ticket.completedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
                      msg += `\n✅ Completed By: ${ticket.completedBy}${completedDateStr ? " on " + completedDateStr : ""}\n`;
                    }
                    if (ticket.photos && ticket.photos.length > 0) {
                      msg += `\n📷 Photos (${ticket.photos.length}):\n`;
                      ticket.photos.forEach((url: string) => { msg += `${url}\n`; });
                    }
                    try {
                      await navigator.clipboard.writeText(msg);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch (err) {
                      console.error("Failed to copy:", err);
                    }
                  }}
                  className="w-full flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all group"
                >
                  <div className={`p-2 rounded-lg shadow-sm group-hover:scale-110 transition-all ${copied ? "bg-green-500" : "bg-gray-500"}`}>
                    {copied ? (
                      <Check className="w-5 h-5 text-white" />
                    ) : (
                      <Copy className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-semibold text-gray-800">
                      {copied ? "Copied!" : "Copy Message"}
                    </div>
                    <div className="text-xs text-gray-600">
                      {copied ? "Message copied to clipboard" : "Copy to clipboard"}
                    </div>
                  </div>
                  {!copied && (
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Audit Summary Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6" onClick={() => setShowAuditModal(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
            style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: colors.accentMedium, borderBottom: `1px solid ${colors.border}` }}>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-white/50">
                  <FileSearch size={20} style={{ color: colors.textDark }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-none" style={{ color: colors.textDark }}>Audit Insights</h2>
                  <p className="text-[10px] font-semibold mt-1 uppercase tracking-wider opacity-70" style={{ color: colors.text }}>Ticket #{ticket.ticketId}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAuditModal(false)}
                className="p-2 rounded-full hover:bg-black/5 transition-colors"
                style={{ color: colors.textDark }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Quick Status Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-dashed flex flex-col items-center justify-center text-center" style={{ borderColor: colors.borderDark, backgroundColor: colors.bgLight }}>
                  <span className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: colors.text }}>Age</span>
                  <span className="text-sm font-black" style={{ color: colors.textDark }}>
                    {ticket.createdAt ? (() => {
                      const totalHours = Math.floor((Date.now() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60));
                      if (totalHours >= 72) {
                        const days = Math.floor(totalHours / 24);
                        const remainingHours = totalHours % 24;
                        return `${days}d ${remainingHours}h`;
                      }
                      return `${totalHours}h`;
                    })() : "N/A"}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-dashed flex flex-col items-center justify-center text-center" style={{ borderColor: colors.borderDark, backgroundColor: colors.bgLight }}>
                  <span className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: colors.text }}>Updates</span>
                  <span className="text-sm font-black" style={{ color: colors.textDark }}>{notes.length} Notes</span>
                </div>
              </div>

              {/* Lifecycle Timeline */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-center" style={{ color: colors.text }}>Lifecycle Timeline</h3>
                
                <div className="relative space-y-6 before:absolute before:inset-0 before:ml-4 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                  {/* Created */}
                  <div className="relative flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="absolute left-0 w-8 h-8 rounded-full border-4 flex items-center justify-center bg-white" style={{ borderColor: colors.accent }}>
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.accent }}></div>
                      </div>
                      <div className="ml-12">
                        <p className="text-sm font-bold" style={{ color: colors.textDark }}>Ticket Created</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs opacity-70" style={{ color: colors.text }}>by {ticket.createdBy || "System"}</p>
                          {ticket.createdBy && getUserType(ticket.createdBy) !== "system" && (
                            <span 
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tight"
                              style={{
                                backgroundColor: getUserType(ticket.createdBy) === 'telegram' ? '#dbeafe' : '#f3e8ff',
                                color: getUserType(ticket.createdBy) === 'telegram' ? '#1d4ed8' : '#7e22ce',
                                border: `1px solid ${getUserType(ticket.createdBy) === 'telegram' ? '#bfdbfe' : '#e9d5ff'}`
                              }}
                            >
                              {getUserType(ticket.createdBy) === 'telegram' ? <MessageSquare size={10} /> : <Monitor size={10} />}
                              {getUserType(ticket.createdBy) === 'telegram' ? 'Telegram' : 'Dashboard'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold" style={{ color: colors.text }}>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ""}</p>
                      <p className="text-[10px] opacity-60" style={{ color: colors.text }}>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}</p>
                    </div>
                  </div>

                  {/* Assigned */}
                  {ticket.assignedTo && (
                    <div className="relative flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="absolute left-0 w-8 h-8 rounded-full border-4 flex items-center justify-center bg-white" style={{ borderColor: colors.textDark }}>
                          <User size={12} style={{ color: colors.textDark }} />
                        </div>
                        <div className="ml-12">
                          <p className="text-sm font-bold" style={{ color: colors.textDark }}>Assigned to Team</p>
                          <p className="text-xs opacity-70" style={{ color: colors.text }}>{ticket.assignedTo.firstName || ticket.assignedTo.username || "Staff"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold" style={{ color: colors.text }}>
                          {ticket.assignedAt ? new Date(ticket.assignedAt).toLocaleDateString() : (ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : "")}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Completed */}
                  {ticket.status === "COMPLETED" && (
                    <div className="relative flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="absolute left-0 w-8 h-8 rounded-full border-4 flex items-center justify-center bg-emerald-500" style={{ borderColor: "#10b981" }}>
                          <Check size={14} className="text-white" />
                        </div>
                        <div className="ml-12">
                          <p className="text-sm font-bold text-emerald-700">Maintenance Completed</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-emerald-600 opacity-80">by {ticket.completedBy || "Unknown"}</p>
                            {ticket.completedBy && getUserType(ticket.completedBy) !== "system" && (
                              <span 
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tight"
                                style={{
                                  backgroundColor: getUserType(ticket.completedBy) === 'telegram' ? '#dbeafe' : '#f3e8ff',
                                  color: getUserType(ticket.completedBy) === 'telegram' ? '#1d4ed8' : '#7e22ce',
                                  border: `1px solid ${getUserType(ticket.completedBy) === 'telegram' ? '#bfdbfe' : '#e9d5ff'}`
                                }}
                              >
                                {getUserType(ticket.completedBy) === 'telegram' ? <MessageSquare size={10} /> : <Monitor size={10} />}
                                {getUserType(ticket.completedBy) === 'telegram' ? 'Telegram' : 'Dashboard'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-emerald-700">{ticket.completedAt ? new Date(ticket.completedAt).toLocaleDateString() : ""}</p>
                        <p className="text-[10px] text-emerald-600 opacity-60">{ticket.completedAt ? new Date(ticket.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Media Summary */}
              <div className="pt-4 border-t border-dashed" style={{ borderColor: colors.border }}>
                <div className="grid grid-cols-3 gap-2 text-[10px] sm:text-xs font-semibold" style={{ color: colors.text }}>
                  <div className="flex flex-col items-center gap-1 border-r border-dashed" style={{ borderColor: colors.border }}>
                    <div className="flex items-center gap-1"><Camera size={14} /> {(ticket.photos?.length || 0) + (ticket.completionPhotos?.length || 0)}</div>
                    <span className="text-[8px] opacity-60 uppercase">Photos</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 border-r border-dashed" style={{ borderColor: colors.border }}>
                    <div className="flex items-center gap-1"><Video size={14} /> {(ticket.videos?.length || 0) + (ticket.completionVideos?.length || 0)}</div>
                    <span className="text-[8px] opacity-60 uppercase">Videos</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1"><FileText size={14} /> {(ticket.documents?.length || 0) + (ticket.completionDocuments?.length || 0)}</div>
                    <span className="text-[8px] opacity-60 uppercase">Files</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 flex items-center justify-end border-t" style={{ borderColor: colors.border }}>
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-6 py-2 rounded-xl text-sm font-bold text-white transition-transform hover:scale-105 active:scale-95"
                style={{ backgroundColor: colors.textDark }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
