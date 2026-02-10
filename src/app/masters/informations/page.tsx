"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import Navbar from "@/components/Navbar";
import {
    Search,
    Trash2,
    FileText,
    User,
    Calendar,
    MessageSquare,
    ChevronLeft,
    ChevronRight,
    Info,
    X,
    Image as ImageIcon,
    Video,
    File as FileIcon,
    Download,
    ExternalLink
} from "lucide-react";

// --- Types ---
interface InformationItem {
    _id: string;
    content: string;
    createdBy: string;
    createdAt: string;
    telegramMessageId?: number | null;
    telegramChatId?: number | null;
    photos?: string[];
    videos?: string[];
    documents?: string[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function InformationsPage() {
    // --- State ---
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // --- Debounce Search ---
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // --- Data Fetching ---
    const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(debouncedSearch && { search: debouncedSearch }),
    });

    const { data, error, mutate, isLoading } = useSWR(
        `/api/masters/informations?${queryParams}`,
        fetcher
    );

    // Auto-hide toast
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    // --- Actions ---
    const handleDelete = async () => {
        if (!deleteTargetId) return;
        const res = await fetch(`/api/masters/informations/${deleteTargetId}`, { method: "DELETE" });

        if (res.ok) {
            mutate();
            setToast({ msg: "Information deleted successfully", type: "success" });
        } else {
            const d = await res.json();
            setToast({ msg: d.error || "Failed to delete", type: "error" });
        }
        setDeleteTargetId(null);
    };

    // --- Helpers ---
    function formatDate(dateStr: string) {
        const date = new Date(dateStr);
        return date.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
    }

    function getRelativeTime(dateStr: string) {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return formatDate(dateStr);
    }

    const informations: InformationItem[] = data?.data || [];
    const totalPages = data?.totalPages || 1;
    const total = data?.total || 0;

    // --- Render ---
    if (error) return <div className="p-10 text-center text-red-500">Failed to load</div>;
    if (!data) return <div className="p-10 text-center text-gray-500 animate-pulse">Loading…</div>;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <Navbar />
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-600 text-white shadow-sm">
                            <Info className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900">
                                Informations
                            </h1>
                            <p className="text-gray-500 text-sm">
                                Messages shared via <code className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-700 text-xs">/info</code> in the group
                            </p>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3">
                        <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 shadow-sm">
                            <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Total</p>
                            <p className="text-2xl font-bold text-gray-900">{total}</p>
                        </div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 mb-8 shadow-sm">
                    <div className="relative flex-1 w-full group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-gray-600 transition-colors">
                            <Search className="w-5 h-5" />
                        </div>
                        <input
                            className="pl-12 w-full bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all py-3 text-sm text-gray-900 placeholder-gray-400"
                            placeholder="Search informations..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm("")}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Information Cards */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-gray-500 animate-pulse">Loading informations...</div>
                    </div>
                ) : informations.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <MessageSquare className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Informations Found</h3>
                        <p className="text-gray-500 max-w-md mx-auto">
                            {searchTerm
                                ? "No results match your search. Try different keywords."
                                : "When someone sends a message with /info in the Telegram group, it will appear here."
                            }
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {informations.map((info) => {
                            const isExpanded = expandedId === info._id;
                            const shouldTruncate = info.content.length > 300;

                            return (
                                <div
                                    key={info._id}
                                    className="group bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200"
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-semibold uppercase">
                                                {info.createdBy.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-gray-900 font-medium flex items-center gap-2">
                                                    <User className="w-4 h-4 text-gray-400" />
                                                    {info.createdBy}
                                                </p>
                                                <p className="text-gray-400 text-xs flex items-center gap-1.5">
                                                    <Calendar className="w-3 h-3" />
                                                    <span className="text-gray-600 font-medium">{getRelativeTime(info.createdAt)}</span>
                                                    <span className="mx-1">•</span>
                                                    <span>{formatDate(info.createdAt)}</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Delete Button */}
                                        <button
                                            onClick={() => setDeleteTargetId(info._id)}
                                            className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Content */}
                                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                                        <div className="flex items-start gap-3">
                                            <FileText className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
                                                    {shouldTruncate && !isExpanded
                                                        ? `${info.content.substring(0, 300)}...`
                                                        : info.content
                                                    }
                                                </p>
                                                {shouldTruncate && (
                                                    <button
                                                        onClick={() => setExpandedId(isExpanded ? null : info._id)}
                                                        className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
                                                    >
                                                        {isExpanded ? "Show less" : "Show more"}
                                                    </button>
                                                )}

                                                {/* Attachments */}
                                                {(info.photos?.length || 0) > 0 && (
                                                    <div className="mt-4">
                                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                            <ImageIcon className="w-3 h-3" />
                                                            Photos ({info.photos?.length})
                                                        </p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {info.photos?.map((photo, idx) => (
                                                                <a 
                                                                    key={idx} 
                                                                    href={photo} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-all group/photo"
                                                                >
                                                                    <img src={photo} alt="" className="w-full h-full object-cover" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 flex items-center justify-center transition-opacity">
                                                                        <ExternalLink className="w-4 h-4 text-white" />
                                                                    </div>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {(info.videos?.length || 0) > 0 && (
                                                    <div className="mt-4">
                                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                            <Video className="w-3 h-3" />
                                                            Videos ({info.videos?.length})
                                                        </p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {info.videos?.map((video, idx) => (
                                                                <a 
                                                                    key={idx} 
                                                                    href={video} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-blue-400 transition-all group/video"
                                                                >
                                                                    <Video className="w-4 h-4 text-blue-500" />
                                                                    <span>Video {idx + 1}</span>
                                                                    <ExternalLink className="w-3 h-3 opacity-0 group-hover/video:opacity-100 transition-opacity" />
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {(info.documents?.length || 0) > 0 && (
                                                    <div className="mt-4">
                                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                            <FileIcon className="w-3 h-3" />
                                                            Documents ({info.documents?.length})
                                                        </p>
                                                        <div className="flex flex-col gap-2">
                                                            {info.documents?.map((doc, idx) => {
                                                                const fileName = doc.split('/').pop()?.split('?')[0] || `Document ${idx + 1}`;
                                                                const isPdf = fileName.toLowerCase().endsWith('.pdf');
                                                                return (
                                                                    <a 
                                                                        key={idx} 
                                                                        href={doc} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer"
                                                                        className="flex items-center justify-between gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-blue-400 group/doc transition-all"
                                                                    >
                                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                                            <div className={`p-2 rounded-lg ${isPdf ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                                                                                <FileIcon className="w-5 h-5" />
                                                                            </div>
                                                                            <span className="text-sm font-medium text-gray-700 truncate">{fileName}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <Download className="w-4 h-4 text-gray-400 group-hover/doc:text-blue-500 transition-colors" />
                                                                        </div>
                                                                    </a>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-8">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-all shadow-sm font-medium"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Previous
                        </button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum = i + 1;
                                if (totalPages > 5) {
                                    if (page <= 3) {
                                        pageNum = i + 1;
                                    } else if (page >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = page - 2 + i;
                                    }
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setPage(pageNum)}
                                        className={`w-10 h-10 rounded-lg font-medium transition-all ${page === pageNum
                                                ? "bg-gray-900 text-white shadow-sm"
                                                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-all shadow-sm font-medium"
                        >
                            Next
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* --- Delete Confirmation Modal --- */}
            {deleteTargetId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200 border border-gray-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-14 h-14 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
                                <Trash2 className="w-7 h-7" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Information?</h3>
                            <p className="text-sm text-gray-500 mb-6">
                                Are you sure you want to delete this information? This action cannot be undone.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setDeleteTargetId(null)}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition-all"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Toast Notification --- */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
                    <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg border ${toast.type === 'success'
                        ? 'bg-green-600 border-green-700 text-white'
                        : 'bg-red-600 border-red-700 text-white'
                        }`}>
                        <div className={`w-2.5 h-2.5 rounded-full ${toast.type === 'success' ? 'bg-green-300' : 'bg-red-300'}`} />
                        <span className="text-sm font-medium">{toast.msg}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
