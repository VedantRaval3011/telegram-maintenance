"use client";

import { useState, useRef, useCallback } from "react";
import useSWR from "swr";
import Navbar from "@/components/Navbar";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Ticket {
    _id: string;
    ticketId: string;
    description: string;
    category: string | null;
    subCategory?: string | null;
    status: "PENDING" | "COMPLETED";
    createdAt: string;
    createdBy?: string;
}

interface FilePreview {
    id: string;
    file: File;
    name: string;
    type: "image" | "video";
    size: number;
    preview: string;
    error?: string;
}

interface UploadConfig {
    maxImageSize: number;
    maxVideoSize: number;
    maxFilesPerUpload: number;
    allowedImageTypes: string[];
    allowedVideoTypes: string[];
    allowedImageExtensions: string[];
    allowedVideoExtensions: string[];
}

export default function MediaUploadPage() {
    const [search, setSearch] = useState("");
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [files, setFiles] = useState<FilePreview[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [mediaField, setMediaField] = useState<"photos" | "completionPhotos">("photos");
    const [uploadedBy, setUploadedBy] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);

    // Fetch tickets
    const { data: ticketsData } = useSWR("/api/tickets", fetcher);

    // Fetch upload config
    const { data: configData } = useSWR("/api/tickets/upload-media", fetcher);

    const tickets: Ticket[] = ticketsData?.data || [];
    const config: UploadConfig = configData?.config || {
        maxImageSize: 10 * 1024 * 1024,
        maxVideoSize: 100 * 1024 * 1024,
        maxFilesPerUpload: 10,
        allowedImageTypes: ["image/jpeg", "image/jpg", "image/png"],
        allowedVideoTypes: ["video/mp4", "video/quicktime"],
        allowedImageExtensions: ["jpg", "jpeg", "png"],
        allowedVideoExtensions: ["mp4", "mov"],
    };

    // Filter tickets based on search
    const filteredTickets = tickets.filter((ticket) => {
        const searchLower = search.toLowerCase();
        return (
            ticket.ticketId.toLowerCase().includes(searchLower) ||
            ticket.description.toLowerCase().includes(searchLower) ||
            (ticket.category || "").toLowerCase().includes(searchLower)
        );
    });

    // Active tickets only (PENDING status)
    const activeTickets = filteredTickets.filter((t) => t.status === "PENDING");

    // Format file size
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    };

    // Validate file
    const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
        const isImage = config.allowedImageTypes.includes(file.type);
        const isVideo = config.allowedVideoTypes.includes(file.type);

        if (!isImage && !isVideo) {
            return {
                valid: false,
                error: `Unsupported format. Allowed: ${[...config.allowedImageExtensions, ...config.allowedVideoExtensions].join(", ").toUpperCase()}`,
            };
        }

        if (isImage && file.size > config.maxImageSize) {
            return {
                valid: false,
                error: `Image exceeds ${config.maxImageSize / (1024 * 1024)}MB limit`,
            };
        }

        if (isVideo && file.size > config.maxVideoSize) {
            return {
                valid: false,
                error: `Video exceeds ${config.maxVideoSize / (1024 * 1024)}MB limit`,
            };
        }

        return { valid: true };
    }, [config]);

    // Handle file selection
    const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
        if (!selectedFiles) return;

        const remainingSlots = config.maxFilesPerUpload - files.length;
        if (remainingSlots <= 0) {
            setStatusMessage({
                type: "error",
                message: `Maximum ${config.maxFilesPerUpload} files allowed`,
            });
            return;
        }

        const newFiles: FilePreview[] = [];
        const filesToProcess = Array.from(selectedFiles).slice(0, remainingSlots);

        for (const file of filesToProcess) {
            const validation = validateFile(file);
            const isVideo = config.allowedVideoTypes.includes(file.type);

            const filePreview: FilePreview = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                file,
                name: file.name,
                type: isVideo ? "video" : "image",
                size: file.size,
                preview: URL.createObjectURL(file),
                error: validation.valid ? undefined : validation.error,
            };

            newFiles.push(filePreview);
        }

        setFiles((prev) => [...prev, ...newFiles]);
        setStatusMessage(null);
    }, [files.length, config, validateFile]);

    // Remove file
    const removeFile = (id: string) => {
        setFiles((prev) => {
            const file = prev.find((f) => f.id === id);
            if (file) {
                URL.revokeObjectURL(file.preview);
            }
            return prev.filter((f) => f.id !== id);
        });
    };

    // Handle drag and drop
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (dropZoneRef.current) {
            dropZoneRef.current.classList.add("border-blue-500", "bg-blue-50");
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (dropZoneRef.current) {
            dropZoneRef.current.classList.remove("border-blue-500", "bg-blue-50");
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (dropZoneRef.current) {
            dropZoneRef.current.classList.remove("border-blue-500", "bg-blue-50");
        }
        handleFileSelect(e.dataTransfer.files);
    };

    // Upload files
    const handleUpload = async () => {
        if (!selectedTicket) {
            setStatusMessage({ type: "error", message: "Please select a ticket first" });
            return;
        }

        const validFiles = files.filter((f) => !f.error);
        if (validFiles.length === 0) {
            setStatusMessage({ type: "error", message: "No valid files to upload" });
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setStatusMessage({ type: "info", message: "Uploading files..." });

        try {
            const formData = new FormData();
            formData.append("ticketId", selectedTicket.ticketId);
            formData.append("uploadedBy", uploadedBy || "Dashboard Admin");
            formData.append("mediaField", mediaField);

            validFiles.forEach((f) => {
                formData.append("files", f.file);
            });

            // Simulate progress
            const progressInterval = setInterval(() => {
                setUploadProgress((prev) => Math.min(prev + 10, 90));
            }, 200);

            const response = await fetch("/api/tickets/upload-media", {
                method: "POST",
                body: formData,
            });

            clearInterval(progressInterval);
            setUploadProgress(100);

            const result = await response.json();

            if (result.ok) {
                setStatusMessage({
                    type: "success",
                    message: `✅ ${result.message}`,
                });

                // Clear files and reset
                files.forEach((f) => URL.revokeObjectURL(f.preview));
                setFiles([]);
                setSelectedTicket(null);
                setSearch("");

                // Reset after 5 seconds
                setTimeout(() => {
                    setStatusMessage(null);
                    setUploadProgress(0);
                }, 5000);
            } else {
                setStatusMessage({
                    type: "error",
                    message: result.error || "Upload failed",
                });
            }
        } catch (error) {
            console.error("Upload error:", error);
            setStatusMessage({
                type: "error",
                message: "Failed to upload files. Please try again.",
            });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 pb-20 font-sans">
            <Navbar />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-0">
                {/* Header Section */}
                <div className="mb-10">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-200">
                            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                                Manual Media Upload
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">
                                Upload images & videos for tickets created offline
                            </p>
                        </div>
                    </div>
                </div>

                {/* Status Message */}
                {statusMessage && (
                    <div
                        className={`mb-6 p-4 rounded-xl border-l-4 flex items-center gap-3 animate-fadeIn ${statusMessage.type === "success"
                            ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                            : statusMessage.type === "error"
                                ? "bg-rose-50 border-rose-500 text-rose-800"
                                : "bg-blue-50 border-blue-500 text-blue-800"
                            }`}
                    >
                        {statusMessage.type === "success" && (
                            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        )}
                        {statusMessage.type === "error" && (
                            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        )}
                        {statusMessage.type === "info" && (
                            <svg className="w-5 h-5 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        <span className="font-medium">{statusMessage.message}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Ticket Selection */}
                    <div className="space-y-6">
                        {/* Ticket Selection Card */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-100/50">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">1</span>
                                    Select Ticket
                                </h2>
                            </div>

                            <div className="p-6">
                                {/* Search Input */}
                                <div className="relative mb-4">
                                    <input
                                        type="text"
                                        placeholder="🔍 Search by ticket ID, description, or category..."
                                        value={search}
                                        onChange={(e) => {
                                            setSearch(e.target.value);
                                            setShowDropdown(true);
                                        }}
                                        onFocus={() => setShowDropdown(true)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    />

                                    {/* Dropdown */}
                                    {showDropdown && search && (
                                        <div className="absolute z-20 w-full mt-2 bg-white rounded-xl border border-gray-200 shadow-2xl max-h-80 overflow-y-auto">
                                            {activeTickets.length === 0 ? (
                                                <div className="p-6 text-gray-500 text-sm text-center">
                                                    <svg className="w-8 h-8 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    No active tickets found matching &quot;{search}&quot;
                                                </div>
                                            ) : (
                                                <div className="py-1">
                                                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                                                        {activeTickets.length} ticket{activeTickets.length !== 1 ? 's' : ''} found
                                                    </div>
                                                    {activeTickets.slice(0, 10).map((ticket) => (
                                                        <button
                                                            key={ticket._id}
                                                            onClick={() => {
                                                                setSelectedTicket(ticket);
                                                                setShowDropdown(false);
                                                                setSearch("");
                                                            }}
                                                            className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-all border-b border-gray-100 last:border-0 group"
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="font-bold text-blue-600 text-base">#{ticket.ticketId}</span>
                                                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded-full uppercase">
                                                                            Pending
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">{ticket.description}</p>
                                                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                                        {ticket.category && (
                                                                            <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                                                                📂 {ticket.category}
                                                                            </span>
                                                                        )}
                                                                        {ticket.subCategory && (
                                                                            <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                                                                                {ticket.subCategory}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="text-right flex-shrink-0">
                                                                    <span className="text-xs text-gray-400 block">
                                                                        {new Date(ticket.createdAt).toLocaleDateString('en-IN', {
                                                                            day: '2-digit',
                                                                            month: 'short',
                                                                            year: 'numeric'
                                                                        })}
                                                                    </span>
                                                                    <span className="text-[10px] text-gray-300 block mt-0.5">
                                                                        {new Date(ticket.createdAt).toLocaleTimeString('en-IN', {
                                                                            hour: '2-digit',
                                                                            minute: '2-digit'
                                                                        })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                    {activeTickets.length > 10 && (
                                                        <div className="px-4 py-2 text-xs text-center text-gray-400 bg-gray-50 border-t border-gray-100">
                                                            Showing first 10 results. Type more to refine search.
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Selected Ticket Display */}
                                {selectedTicket && (
                                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="font-bold text-blue-700 text-lg">#{selectedTicket.ticketId}</span>
                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                                                        {selectedTicket.status}
                                                    </span>
                                                </div>
                                                <p className="text-gray-700 text-sm mb-2">{selectedTicket.description}</p>
                                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                                    {selectedTicket.category && (
                                                        <span className="flex items-center gap-1">
                                                            📂 {selectedTicket.category}
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1">
                                                        📅 {new Date(selectedTicket.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSelectedTicket(null)}
                                                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {!selectedTicket && !search && (
                                    <div className="text-center py-8 text-gray-400">
                                        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                        </svg>
                                        <p className="text-sm">Search and select a ticket to upload media</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Upload Options */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-100/50 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-bold">⚙</span>
                                    Upload Options
                                </h2>
                            </div>

                            <div className="p-6 space-y-4">
                                {/* Media Field Selection */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                                        Attach Media To
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setMediaField("photos")}
                                            className={`p-3 rounded-xl border-2 transition-all flex items-center gap-2 ${mediaField === "photos"
                                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                                : "border-gray-200 hover:border-gray-300 text-gray-600"
                                                }`}
                                        >
                                            <span className="text-lg">📸</span>
                                            <span className="font-medium text-sm">Initial Photos</span>
                                        </button>
                                        <button
                                            onClick={() => setMediaField("completionPhotos")}
                                            className={`p-3 rounded-xl border-2 transition-all flex items-center gap-2 ${mediaField === "completionPhotos"
                                                ? "border-green-500 bg-green-50 text-green-700"
                                                : "border-gray-200 hover:border-gray-300 text-gray-600"
                                                }`}
                                        >
                                            <span className="text-lg">✅</span>
                                            <span className="font-medium text-sm">Completion Photos</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Uploaded By */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                                        Uploaded By
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Enter your name (optional)"
                                        value={uploadedBy}
                                        onChange={(e) => setUploadedBy(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm"
                                    />
                                </div>

                                {/* Config Info */}
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <p className="text-xs text-gray-500">
                                        <strong>Limits:</strong> Images up to {config.maxImageSize / (1024 * 1024)}MB, Videos up to {config.maxVideoSize / (1024 * 1024)}MB • Max {config.maxFilesPerUpload} files
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        <strong>Formats:</strong> {[...config.allowedImageExtensions, ...config.allowedVideoExtensions].map(e => e.toUpperCase()).join(", ")}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Media Upload */}
                    <div className="space-y-6">
                        {/* Upload Zone */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-100/50 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold">2</span>
                                    Upload Media
                                </h2>
                            </div>

                            <div className="p-6">
                                {/* Drop Zone */}
                                <div
                                    ref={dropZoneRef}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all"
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,video/mp4,video/quicktime"
                                        multiple
                                        onChange={(e) => handleFileSelect(e.target.files)}
                                        className="hidden"
                                    />

                                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                                        <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>

                                    <h3 className="text-lg font-semibold text-gray-700 mb-1">
                                        Drop files here or click to browse
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        Support for JPG, PNG images and MP4, MOV videos
                                    </p>
                                </div>

                                {/* File Previews */}
                                {files.length > 0 && (
                                    <div className="mt-6">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-semibold text-gray-700">
                                                Selected Files ({files.length}/{config.maxFilesPerUpload})
                                            </h3>
                                            <button
                                                onClick={() => {
                                                    files.forEach((f) => URL.revokeObjectURL(f.preview));
                                                    setFiles([]);
                                                }}
                                                className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                                            >
                                                Clear All
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            {files.map((file) => (
                                                <div
                                                    key={file.id}
                                                    className={`relative rounded-xl overflow-hidden border-2 ${file.error ? "border-rose-300 bg-rose-50" : "border-gray-200"
                                                        }`}
                                                >
                                                    {/* Preview */}
                                                    <div className="aspect-video bg-gray-100 relative">
                                                        {file.type === "image" ? (
                                                            <img
                                                                src={file.preview}
                                                                alt={file.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                                                <video
                                                                    src={file.preview}
                                                                    className="max-w-full max-h-full"
                                                                    muted
                                                                />
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                    <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center">
                                                                        <svg className="w-6 h-6 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                                                        </svg>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Type Badge */}
                                                        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-semibold ${file.type === "video"
                                                            ? "bg-purple-600 text-white"
                                                            : "bg-blue-600 text-white"
                                                            }`}>
                                                            {file.type === "video" ? "📹 VIDEO" : "📷 IMAGE"}
                                                        </div>

                                                        {/* Remove Button */}
                                                        <button
                                                            onClick={() => removeFile(file.id)}
                                                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>

                                                    {/* File Info */}
                                                    <div className="p-2">
                                                        <p className="text-xs font-medium text-gray-700 truncate" title={file.name}>
                                                            {file.name}
                                                        </p>
                                                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                                                        {file.error && (
                                                            <p className="text-xs text-rose-600 mt-1 font-medium">
                                                                ⚠️ {file.error}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Upload Progress & Submit */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-100/50 overflow-hidden">
                            <div className="p-6">
                                {/* Progress Bar */}
                                {isUploading && (
                                    <div className="mb-4">
                                        <div className="flex items-center justify-between text-sm mb-2">
                                            <span className="text-gray-600 font-medium">Uploading...</span>
                                            <span className="text-blue-600 font-bold">{uploadProgress}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                                                style={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Submit Button */}
                                <button
                                    onClick={handleUpload}
                                    disabled={!selectedTicket || files.filter(f => !f.error).length === 0 || isUploading}
                                    className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${!selectedTicket || files.filter(f => !f.error).length === 0 || isUploading
                                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                        : "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-200 hover:shadow-xl active:scale-[0.98]"
                                        }`}
                                >
                                    {isUploading ? (
                                        <>
                                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                            Upload & Attach to Ticket
                                        </>
                                    )}
                                </button>

                                {/* Validation Messages */}
                                {!selectedTicket && (
                                    <p className="text-center text-sm text-amber-600 mt-3">
                                        ⚠️ Please select a ticket first
                                    </p>
                                )}
                                {selectedTicket && files.filter(f => !f.error).length === 0 && files.length > 0 && (
                                    <p className="text-center text-sm text-rose-600 mt-3">
                                        ⚠️ All selected files have validation errors
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Footer */}
                <div className="mt-10 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100 p-6">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        Offline Recovery Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div className="flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">✓</span>
                            <span>Use this feature when media couldn&apos;t be uploaded during ticket creation due to offline mode</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">✓</span>
                            <span>All uploads are tagged with <code className="bg-gray-100 px-1 rounded">source: manual_upload</code> for tracking</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">✓</span>
                            <span>Media is automatically associated with the selected ticket</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">✓</span>
                            <span>Upload metadata includes timestamp and operator information</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Click outside to close dropdown */}
            {showDropdown && (
                <div
                    className="fixed inset-0 z-0"
                    onClick={() => setShowDropdown(false)}
                />
            )}
        </div>
    );
}
