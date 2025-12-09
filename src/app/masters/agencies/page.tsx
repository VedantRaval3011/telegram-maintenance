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
    Layers,
    Tag,
} from "lucide-react";
import { toast } from "react-hot-toast";

interface ICategory {
    _id: string;
    displayName: string;
    color: string | null;
}

interface IAgency {
    _id: string;
    name: string;
    phone: string;
    email: string;
    notes: string;
    categories: ICategory[];
}

export default function AgenciesPage() {
    const [agencies, setAgencies] = useState<IAgency[]>([]);
    const [categories, setCategories] = useState<ICategory[]>([]);
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
        categories: [] as string[],  // Array of category IDs
    });

    useEffect(() => {
        fetchAgencies();
        fetchCategories();
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

    const fetchCategories = async () => {
        try {
            const res = await fetch("/api/masters/categories");
            const data = await res.json();
            if (data.success) {
                setCategories(data.data);
            }
        } catch (error) {
            console.error("Failed to fetch categories", error);
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
                categories: agency.categories?.map(c => c._id) || [],
            });
        } else {
            setEditingAgency(null);
            setFormData({ name: "", phone: "", email: "", notes: "", categories: [] });
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
        <div className="min-h-screen bg-white pb-20">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-4xl font-extrabold text-gray-900">
                            Agency Master
                        </h1>
                        <p className="text-gray-600 mt-2 text-sm font-medium">
                            Manage contractors and agencies for tickets
                        </p>
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="inline-flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-gray-900/20 transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Add Agency
                    </button>
                </div>

                {/* Search Toolbar */}
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-8 shadow-sm">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                            <Search className="w-5 h-5" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name, phone, or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 w-full bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all py-3 text-sm text-gray-900 placeholder-gray-500"
                        />
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
                        <div className="text-center py-16">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto"></div>
                            <p className="mt-4 text-gray-600">Loading agencies...</p>
                        </div>
                    </div>
                ) : filteredAgencies.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
                        <div className="text-center py-16">
                            <Building2 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                            <p className="text-gray-600 mb-4">No agencies found</p>
                            <button
                                onClick={() => handleOpenModal()}
                                className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-bold shadow-lg"
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
                                className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl hover:border-gray-300 transition-all group"
                            >
                                <div className="p-6">
                                    {/* Header */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 border border-gray-200">
                                                <Building2 className="w-5 h-5" />
                                            </div>
                                            <h3 className="font-bold text-gray-900 text-lg">
                                                {agency.name}
                                            </h3>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleOpenModal(agency)}
                                                className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
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
                                            <div className="flex items-center gap-2 text-gray-700">
                                                <Phone className="w-4 h-4 text-gray-500" />
                                                <span>{agency.phone}</span>
                                            </div>
                                        )}
                                        {agency.email && (
                                            <div className="flex items-center gap-2 text-gray-700">
                                                <Mail className="w-4 h-4 text-gray-500" />
                                                <span>{agency.email}</span>
                                            </div>
                                        )}
                                        {agency.notes && (
                                            <div className="flex items-start gap-2 text-gray-700 mt-3 pt-3 border-t border-gray-200">
                                                <FileText className="w-4 h-4 text-gray-500 mt-0.5" />
                                                <span className="text-xs">{agency.notes}</span>
                                            </div>
                                        )}
                                        {/* Linked Categories */}
                                        {agency.categories && agency.categories.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-gray-200">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Layers className="w-4 h-4 text-gray-500" />
                                                    <span className="text-xs text-gray-500 font-medium">Linked Categories</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {agency.categories.map((cat) => (
                                                        <span
                                                            key={cat._id}
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                                                            style={{
                                                                backgroundColor: cat.color ? `${cat.color}20` : '#f3f4f6',
                                                                color: cat.color || '#6b7280',
                                                                border: `1px solid ${cat.color ? `${cat.color}40` : '#e5e7eb'}`
                                                            }}
                                                        >
                                                            <Tag className="w-3 h-3" />
                                                            {cat.displayName}
                                                        </span>
                                                    ))}
                                                </div>
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm overflow-hidden">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 max-h-[90vh] flex flex-col">
                            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                <h2 className="text-lg font-bold text-gray-900">
                                    {editingAgency ? "Edit Agency" : "Add Agency"}
                                </h2>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-gray-600 hover:text-gray-900 transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4 overflow-y-auto flex-1">
                                {/* Name */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                        Agency Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) =>
                                            setFormData({ ...formData, name: e.target.value })
                                        }
                                        placeholder="Enter agency name"
                                        className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                                    />
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                        Phone Number
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) =>
                                            setFormData({ ...formData, phone: e.target.value })
                                        }
                                        placeholder="Enter phone number"
                                        className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                                    />
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) =>
                                            setFormData({ ...formData, email: e.target.value })
                                        }
                                        placeholder="Enter email address"
                                        className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                                    />
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                        Notes / Extra Info
                                    </label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) =>
                                            setFormData({ ...formData, notes: e.target.value })
                                        }
                                        placeholder="Any additional information..."
                                        rows={3}
                                        className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all resize-none"
                                    />
                                </div>

                                {/* Categories Multi-Select */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                        <Layers className="w-4 h-4 inline-block mr-1" />
                                        Link to Categories
                                    </label>
                                    <p className="text-xs text-gray-500 mb-3">
                                        Select which categories this agency can handle. This creates a bidirectional link.
                                    </p>
                                    <div className="bg-gray-50 border border-gray-300 rounded-xl p-2 max-h-32 overflow-y-auto">
                                        {categories.length === 0 ? (
                                            <p className="text-gray-500 text-sm text-center py-2">No categories available</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {categories.map((cat) => (
                                                    <label
                                                        key={cat._id}
                                                        className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all ${formData.categories.includes(cat._id)
                                                            ? 'bg-gray-200 border border-gray-400'
                                                            : 'hover:bg-gray-100 border border-transparent'
                                                            }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.categories.includes(cat._id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setFormData({
                                                                        ...formData,
                                                                        categories: [...formData.categories, cat._id]
                                                                    });
                                                                } else {
                                                                    setFormData({
                                                                        ...formData,
                                                                        categories: formData.categories.filter(id => id !== cat._id)
                                                                    });
                                                                }
                                                            }}
                                                            className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                                                        />
                                                        <span
                                                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm font-medium"
                                                            style={{
                                                                backgroundColor: cat.color ? `${cat.color}20` : '#f3f4f6',
                                                                color: cat.color || '#374151',
                                                                border: `1px solid ${cat.color ? `${cat.color}40` : '#e5e7eb'}`
                                                            }}
                                                        >
                                                            <Tag className="w-3.5 h-3.5" />
                                                            {cat.displayName}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {formData.categories.length > 0 && (
                                        <p className="text-xs text-gray-600 mt-2">
                                            {formData.categories.length} categor{formData.categories.length === 1 ? 'y' : 'ies'} selected
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl shadow-lg shadow-gray-900/20 transition-all flex items-center gap-2 active:scale-95"
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