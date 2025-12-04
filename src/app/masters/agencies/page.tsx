"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    X,
    Save,
    Phone,
    Mail,
    FileText,
    Building2,
} from "lucide-react";
import { toast } from "react-hot-toast";

interface IAgency {
    _id: string;
    name: string;
    phone: string;
    email: string;
    notes: string;
}

export default function AgenciesPage() {
    const [agencies, setAgencies] = useState<IAgency[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAgency, setEditingAgency] = useState<IAgency | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        email: "",
        notes: "",
    });

    useEffect(() => {
        fetchAgencies();
    }, []);

    const fetchAgencies = async () => {
        try {
            const res = await fetch("/api/masters/agencies");
            const data = await res.json();
            if (data.success) {
                setAgencies(data.data);
            }
        } catch (error) {
            console.error("Failed to fetch agencies", error);
            toast.error("Failed to load agencies");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (agency?: IAgency) => {
        if (agency) {
            setEditingAgency(agency);
            setFormData({
                name: agency.name,
                phone: agency.phone,
                email: agency.email,
                notes: agency.notes,
            });
        } else {
            setEditingAgency(null);
            setFormData({ name: "", phone: "", email: "", notes: "" });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error("Agency name is required");
            return;
        }

        try {
            const res = await fetch("/api/masters/agencies", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    _id: editingAgency?._id,
                }),
            });

            const data = await res.json();
            if (data.success) {
                toast.success(
                    editingAgency ? "Agency updated successfully" : "Agency created successfully"
                );
                setIsModalOpen(false);
                fetchAgencies();
            } else {
                toast.error(data.error || "Failed to save agency");
            }
        } catch (error) {
            console.error("Error saving agency", error);
            toast.error("An error occurred");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this agency?")) return;

        try {
            const res = await fetch(`/api/masters/agencies?id=${id}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Agency deleted");
                fetchAgencies();
            } else {
                toast.error(data.error || "Failed to delete");
            }
        } catch (error) {
            toast.error("Error deleting agency");
        }
    };

    // Filter agencies
    const filteredAgencies = agencies.filter(
        (a) =>
            a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.phone.includes(searchTerm) ||
            a.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[#e8d5c4] pb-20">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-4xl font-extrabold text-[#2c2420]">
                            Agency Master
                        </h1>
                        <p className="text-[#5c4a3d] mt-2 text-sm font-medium">
                            Manage contractors and agencies for tickets
                        </p>
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="inline-flex items-center justify-center gap-2 bg-[#2c2420] hover:bg-[#3d332c] text-[#f5ebe0] px-6 py-3 rounded-xl font-bold shadow-lg shadow-[#2c2420]/20 transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Add Agency
                    </button>
                </div>

                {/* Search Toolbar */}
                <div className="bg-[#d4c0ae]/50 backdrop-blur-md border border-[#b8a293] rounded-2xl p-4 mb-8 shadow-sm">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7d6856]">
                            <Search className="w-5 h-5" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name, phone, or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 w-full bg-[#f5ebe0] border border-[#c9b6a5] rounded-xl focus:ring-2 focus:ring-[#7d6856]/40 focus:border-[#7d6856] transition-all py-3 text-sm text-[#2c2420] placeholder-[#9c8672]"
                        />
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="bg-[#f5ebe0] border border-[#c9b6a5] rounded-2xl shadow-xl overflow-hidden">
                        <div className="text-center py-16">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7d6856] mx-auto"></div>
                            <p className="mt-4 text-[#7d6856]">Loading agencies...</p>
                        </div>
                    </div>
                ) : filteredAgencies.length === 0 ? (
                    <div className="bg-[#f5ebe0] border border-[#c9b6a5] rounded-2xl shadow-xl overflow-hidden">
                        <div className="text-center py-16">
                            <Building2 className="w-16 h-16 mx-auto text-[#9c8672] mb-4" />
                            <p className="text-[#7d6856] mb-4">No agencies found</p>
                            <button
                                onClick={() => handleOpenModal()}
                                className="px-6 py-3 bg-[#2c2420] text-[#f5ebe0] rounded-xl hover:bg-[#3d332c] transition-colors font-bold shadow-lg"
                            >
                                Add First Agency
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredAgencies.map((agency) => (
                            <div
                                key={agency._id}
                                className="bg-[#f5ebe0] backdrop-blur-sm border border-[#c9b6a5] rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl hover:border-[#9c8672] transition-all group"
                            >
                                <div className="p-6">
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-[#d4c0ae] flex items-center justify-center text-[#5c4a3d] border border-[#b8a293]">
                                                <Building2 className="w-5 h-5" />
                                            </div>
                                            <h3 className="font-bold text-[#2c2420] text-lg">
                                                {agency.name}
                                            </h3>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleOpenModal(agency)}
                                                className="p-2 hover:bg-[#e8d5c4] rounded-lg text-[#5c4a3d] transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(agency._id)}
                                                className="p-2 hover:bg-rose-100 rounded-lg text-rose-600 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="space-y-2 text-sm">
                                        {agency.phone && (
                                            <div className="flex items-center gap-2 text-[#5c4a3d]">
                                                <Phone className="w-4 h-4 text-[#9c8672]" />
                                                <span>{agency.phone}</span>
                                            </div>
                                        )}
                                        {agency.email && (
                                            <div className="flex items-center gap-2 text-[#5c4a3d]">
                                                <Mail className="w-4 h-4 text-[#9c8672]" />
                                                <span>{agency.email}</span>
                                            </div>
                                        )}
                                        {agency.notes && (
                                            <div className="flex items-start gap-2 text-[#5c4a3d] mt-3 pt-3 border-t border-[#dccab9]">
                                                <FileText className="w-4 h-4 text-[#9c8672] mt-0.5" />
                                                <span className="text-xs">{agency.notes}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2c2420]/20 backdrop-blur-sm">
                        <div className="bg-[#f5ebe0] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-[#c9b6a5]">
                            <div className="px-6 py-4 border-b border-[#dccab9] flex justify-between items-center bg-[#e8d5c4]">
                                <h2 className="text-lg font-bold text-[#2c2420]">
                                    {editingAgency ? "Edit Agency" : "Add Agency"}
                                </h2>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-[#7d6856] hover:text-[#2c2420] transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                {/* Name */}
                                <div>
                                    <label className="block text-xs font-semibold text-[#5c4a3d] mb-2 uppercase tracking-wide">
                                        Agency Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) =>
                                            setFormData({ ...formData, name: e.target.value })
                                        }
                                        placeholder="Enter agency name"
                                        className="w-full p-3 bg-[#ede0d1] border border-[#c9b6a5] rounded-xl text-[#2c2420] focus:ring-2 focus:ring-[#7d6856]/20 focus:border-[#7d6856] outline-none transition-all"
                                    />
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="block text-xs font-semibold text-[#5c4a3d] mb-2 uppercase tracking-wide">
                                        Phone Number
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) =>
                                            setFormData({ ...formData, phone: e.target.value })
                                        }
                                        placeholder="Enter phone number"
                                        className="w-full p-3 bg-[#ede0d1] border border-[#c9b6a5] rounded-xl text-[#2c2420] focus:ring-2 focus:ring-[#7d6856]/20 focus:border-[#7d6856] outline-none transition-all"
                                    />
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-xs font-semibold text-[#5c4a3d] mb-2 uppercase tracking-wide">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) =>
                                            setFormData({ ...formData, email: e.target.value })
                                        }
                                        placeholder="Enter email address"
                                        className="w-full p-3 bg-[#ede0d1] border border-[#c9b6a5] rounded-xl text-[#2c2420] focus:ring-2 focus:ring-[#7d6856]/20 focus:border-[#7d6856] outline-none transition-all"
                                    />
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-xs font-semibold text-[#5c4a3d] mb-2 uppercase tracking-wide">
                                        Notes / Extra Info
                                    </label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) =>
                                            setFormData({ ...formData, notes: e.target.value })
                                        }
                                        placeholder="Any additional information..."
                                        rows={3}
                                        className="w-full p-3 bg-[#ede0d1] border border-[#c9b6a5] rounded-xl text-[#2c2420] focus:ring-2 focus:ring-[#7d6856]/20 focus:border-[#7d6856] outline-none transition-all resize-none"
                                    />
                                </div>
                            </div>

                            <div className="p-6 border-t border-[#dccab9] bg-[#e8d5c4] flex justify-end gap-3">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 text-[#5c4a3d] font-medium hover:bg-[#d4c0ae] rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-5 py-2.5 bg-[#2c2420] hover:bg-[#3d332c] text-[#f5ebe0] font-bold rounded-xl shadow-lg shadow-[#2c2420]/20 transition-all flex items-center gap-2 active:scale-95"
                                >
                                    <Save className="w-4 h-4" />
                                    Save Agency
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
