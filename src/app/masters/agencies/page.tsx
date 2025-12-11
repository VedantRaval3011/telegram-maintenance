"use client";

// Last updated: 2025-12-10 16:24 - Added sorting, highlighting, and Others option

import { useState, useEffect, useMemo } from "react";
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
    FolderTree,
    GitBranch,
} from "lucide-react";
import { toast } from "react-hot-toast";

interface ICategory {
    _id: string;
    displayName: string;
    color: string | null;
}

interface ISubCategory {
    _id: string;
    name: string;
    icon?: string | null;
    categoryId: ICategory | string | null;
}

interface IAgency {
    _id: string;
    name: string;
    phone: string;
    email: string;
    notes: string;
    categories: ICategory[];
    subCategories: ISubCategory[];
}

export default function AgenciesPage() {
    const [agencies, setAgencies] = useState<IAgency[]>([]);
    const [categories, setCategories] = useState<ICategory[]>([]);
    const [allSubCategories, setAllSubCategories] = useState<ISubCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [subCategorySearchTerm, setSubCategorySearchTerm] = useState(""); // Search for subcategories in modal

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAgency, setEditingAgency] = useState<IAgency | null>(null);

    // Chart popup state
    const [isChartPopupOpen, setIsChartPopupOpen] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        email: "",
        notes: "",
        categories: [] as string[],
        subCategories: [] as string[],
    });

    useEffect(() => {
        fetchAgencies();
        fetchCategories();
        fetchSubCategories();
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

    const fetchSubCategories = async () => {
        try {
            const res = await fetch("/api/masters/subcategories");
            const data = await res.json();
            if (data.success) {
                setAllSubCategories(data.data);
            }
        } catch (error) {
            console.error("Failed to fetch subcategories", error);
        }
    };

    // Build hierarchical structure
    const categoryTree = useMemo(() => {
        return categories.map(cat => ({
            ...cat,
            subCategories: allSubCategories.filter(sub => {
                // Handle both string and object categoryId
                let subCatId: string | null = null;
                if (typeof sub.categoryId === 'string') {
                    subCatId = sub.categoryId;
                } else if (sub.categoryId && typeof sub.categoryId === 'object') {
                    subCatId = (sub.categoryId as ICategory)._id;
                }
                return subCatId === cat._id;
            })
        }));
    }, [categories, allSubCategories]);

    const handleOpenModal = (agency?: IAgency) => {
        if (agency) {
            setEditingAgency(agency);
            setFormData({
                name: agency.name,
                phone: agency.phone,
                email: agency.email,
                notes: agency.notes,
                categories: agency.categories?.map(c => c._id) || [],
                subCategories: agency.subCategories?.map(s => s._id) || [],
            });
        } else {
            setEditingAgency(null);
            setFormData({ name: "", phone: "", email: "", notes: "", categories: [], subCategories: [] });
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
                setIsChartPopupOpen(false);
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

    const toggleSubCategorySelection = (subId: string) => {
        setFormData(prev => {
            const isSelected = prev.subCategories.includes(subId);
            return {
                ...prev,
                subCategories: isSelected
                    ? prev.subCategories.filter(id => id !== subId)
                    : [...prev.subCategories, subId]
            };
        });
    };

    // Toggle all subcategories of a category, or toggle the category itself if no subcategories
    const toggleCategorySelection = (catId: string) => {
        // Get all subcategory IDs that belong to this category
        const subsInCategory = allSubCategories
            .filter(sub => {
                // Handle both string and object categoryId
                let subCatId: string | null = null;
                if (typeof sub.categoryId === 'string') {
                    subCatId = sub.categoryId;
                } else if (sub.categoryId && typeof sub.categoryId === 'object') {
                    subCatId = (sub.categoryId as ICategory)._id;
                }
                return subCatId === catId;
            })
            .map(sub => sub._id);

        console.log('Category ID:', catId);
        console.log('Subcategories found:', subsInCategory);

        // If no subcategories, toggle the category itself
        if (subsInCategory.length === 0) {
            setFormData(prev => {
                const isCategorySelected = prev.categories.includes(catId);
                return {
                    ...prev,
                    categories: isCategorySelected
                        ? prev.categories.filter(id => id !== catId)
                        : [...prev.categories, catId]
                };
            });
            return;
        }

        setFormData(prev => {
            // Check if all subcategories in this category are already selected
            const allSelected = subsInCategory.every(subId => prev.subCategories.includes(subId));

            if (allSelected) {
                // Deselect all subcategories in this category
                return {
                    ...prev,
                    subCategories: prev.subCategories.filter(id => !subsInCategory.includes(id))
                };
            } else {
                // Select all subcategories in this category
                const newSelection = [...prev.subCategories];
                subsInCategory.forEach(subId => {
                    if (!newSelection.includes(subId)) {
                        newSelection.push(subId);
                    }
                });
                return {
                    ...prev,
                    subCategories: newSelection
                };
            }
        });
    };

    // Filter agencies
    const filteredAgencies = agencies.filter(
        (a) =>
            a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.phone.includes(searchTerm) ||
            a.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Group subcategories by their parent category for display
    const groupSubCategoriesByCategory = (subCategories: ISubCategory[]) => {
        const grouped: { [catId: string]: { category: ICategory; subs: ISubCategory[] } } = {};

        subCategories.forEach(sub => {
            if (sub.categoryId) {
                const cat = typeof sub.categoryId === 'object' ? sub.categoryId as ICategory : null;
                if (cat) {
                    if (!grouped[cat._id]) {
                        grouped[cat._id] = { category: cat, subs: [] };
                    }
                    grouped[cat._id].subs.push(sub);
                }
            }
        });

        return Object.values(grouped);
    };

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
                            Manage contractors and agencies linked to subcategories
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

                                        {/* Linked Categories (Legacy) */}
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

                                        {/* Linked SubCategories */}
                                        {agency.subCategories && agency.subCategories.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-gray-200">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <FolderTree className="w-4 h-4 text-gray-500" />
                                                    <span className="text-xs text-gray-500 font-medium">Linked SubCategories</span>
                                                </div>
                                                <div className="space-y-2">
                                                    {groupSubCategoriesByCategory(agency.subCategories).map(({ category, subs }) => (
                                                        <div key={category._id} className="space-y-1">
                                                            <div
                                                                className="flex items-center gap-1.5 text-xs font-semibold"
                                                                style={{ color: category.color || '#6b7280' }}
                                                            >
                                                                <Layers className="w-3 h-3" />
                                                                {category.displayName}
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5 ml-4">
                                                                {subs.map((sub) => (
                                                                    <span
                                                                        key={sub._id}
                                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                                                                        style={{
                                                                            backgroundColor: category.color ? `${category.color}15` : '#f3f4f6',
                                                                            color: category.color || '#6b7280',
                                                                            border: `1px solid ${category.color ? `${category.color}30` : '#e5e7eb'}`
                                                                        }}
                                                                    >
                                                                        <Tag className="w-3 h-3" />
                                                                        {sub.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
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

                {/* Agency Form Modal */}
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

                                {/* Link SubCategories Button */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                        <FolderTree className="w-4 h-4 inline-block mr-1" />
                                        Link to SubCategories
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setIsChartPopupOpen(true)}
                                        className="w-full p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-dashed border-indigo-300 rounded-xl text-indigo-700 hover:border-indigo-400 hover:from-indigo-100 hover:to-purple-100 transition-all flex items-center justify-center gap-3 group"
                                    >
                                        <GitBranch className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        <span className="font-semibold">
                                            {formData.subCategories.length > 0
                                                ? `${formData.subCategories.length} SubCategor${formData.subCategories.length === 1 ? 'y' : 'ies'} Selected - Click to Edit`
                                                : "Open Chart to Select SubCategories"
                                            }
                                        </span>
                                    </button>

                                    {/* Show selected subcategories preview */}
                                    {formData.subCategories.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                            {formData.subCategories.map(subId => {
                                                const sub = allSubCategories.find(s => s._id === subId);
                                                if (!sub) return null;
                                                const cat = categories.find(c => {
                                                    const catId = typeof sub.categoryId === 'object' && sub.categoryId
                                                        ? (sub.categoryId as ICategory)._id
                                                        : sub.categoryId;
                                                    return c._id === catId;
                                                });
                                                return (
                                                    <span
                                                        key={subId}
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                                                        style={{
                                                            backgroundColor: cat?.color ? `${cat.color}15` : '#f3f4f6',
                                                            color: cat?.color || '#6b7280',
                                                            border: `1px solid ${cat?.color ? `${cat.color}30` : '#e5e7eb'}`
                                                        }}
                                                    >
                                                        <Tag className="w-3 h-3" />
                                                        {sub.name}
                                                    </span>
                                                );
                                            })}
                                        </div>
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
                {/* Chart Popup - Folder Structure */}
                {isChartPopupOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-200 max-h-[90vh] flex flex-col">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-800">
                                <div className="flex items-center gap-3">
                                    <FolderTree className="w-6 h-6 text-yellow-400" />
                                    <div>
                                        <h2 className="text-lg font-bold text-white">
                                            {formData.name || editingAgency?.name || "Agency"} - Subcategory
                                        </h2>
                                        <p className="text-gray-400 text-xs">
                                            Click on subcategories to select/deselect
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsChartPopupOpen(false)}
                                    className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Search Input */}
                            <div className="p-4 border-b border-gray-200 bg-white">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by category or subcategory name..."
                                        value={subCategorySearchTerm}
                                        onChange={(e) => setSubCategorySearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder-gray-500"
                                    />
                                    {subCategorySearchTerm && (
                                        <button
                                            onClick={() => setSubCategorySearchTerm("")}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Folder Tree Content */}
                            <div className="p-4 overflow-y-auto flex-1 bg-gray-50">
                                {categoryTree.length === 0 ? (
                                    <div className="text-center py-12">
                                        <FolderTree className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                                        <p className="text-gray-500">No categories available</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1 font-mono text-sm">
                                        {categoryTree.map((cat, catIndex) => {
                                            // Simple filter: show category if it matches search OR has matching subcategories
                                            const categoryMatches = cat.displayName.toLowerCase().includes(subCategorySearchTerm.toLowerCase());
                                            const matchingSubCategories = cat.subCategories.filter(sub =>
                                                sub.name.toLowerCase().includes(subCategorySearchTerm.toLowerCase())
                                            );
                                            
                                            // Hide category if search is active and neither category nor subcategories match
                                            if (subCategorySearchTerm && !categoryMatches && matchingSubCategories.length === 0) {
                                                return null;
                                            }
                                            
                                            // Determine which subcategories to show
                                            const subsToShow = subCategorySearchTerm && !categoryMatches 
                                                ? matchingSubCategories  // If searching and category doesn't match, show only matching subs
                                                : cat.subCategories;      // Otherwise show all subs
                                            
                                            const selectedCount = cat.subCategories.filter(s => formData.subCategories.includes(s._id)).length;
                                            const isCategoryDirectlySelected = formData.categories.includes(cat._id);
                                            const isLast = catIndex === categoryTree.length - 1;
                                            const hasNoSubcategories = cat.subCategories.length === 0;

                                            return (
                                                <div key={cat._id} className="select-none">
                                                    {/* Category Folder */}
                                                    <div className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-100 transition-colors">
                                                        <span className="text-gray-400 w-4">{isLast ? '└' : '├'}</span>

                                                        {/* Category Checkbox - selects/deselects all subcategories, or the category itself if no subcategories */}
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleCategorySelection(cat._id)}
                                                            className={`
                                                                w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 cursor-pointer
                                                                ${hasNoSubcategories
                                                                    ? isCategoryDirectlySelected
                                                                        ? 'border-indigo-600 bg-indigo-600'
                                                                        : 'border-gray-400 bg-white hover:border-gray-500'
                                                                    : selectedCount === cat.subCategories.length && selectedCount > 0
                                                                        ? 'border-indigo-600 bg-indigo-600'
                                                                        : selectedCount > 0
                                                                            ? 'border-indigo-400 bg-indigo-200'
                                                                            : 'border-gray-400 bg-white hover:border-gray-500'
                                                                }
                                                            `}
                                                        >
                                                            {/* Show checkmark for categories without subcategories when selected */}
                                                            {hasNoSubcategories && isCategoryDirectlySelected && (
                                                                <svg className="w-3 h-3 text-white" viewBox="0 0 14 14" fill="none">
                                                                    <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                                </svg>
                                                            )}
                                                            {/* Show checkmark for categories with all subcategories selected */}
                                                            {!hasNoSubcategories && selectedCount === cat.subCategories.length && selectedCount > 0 && (
                                                                <svg className="w-3 h-3 text-white" viewBox="0 0 14 14" fill="none">
                                                                    <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                                </svg>
                                                            )}
                                                            {/* Show partial indicator for partially selected categories */}
                                                            {!hasNoSubcategories && selectedCount > 0 && selectedCount < cat.subCategories.length && (
                                                                <div className="w-2 h-0.5 bg-indigo-600 rounded"></div>
                                                            )}
                                                        </button>

                                                        <span className="text-yellow-500 text-lg">📁</span>
                                                        <span
                                                            className="font-semibold"
                                                            style={{ color: cat.color || '#374151' }}
                                                        >
                                                            {cat.displayName}
                                                        </span>
                                                        {/* Show selection indicator */}
                                                        {hasNoSubcategories && isCategoryDirectlySelected && (
                                                            <span
                                                                className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold"
                                                                style={{
                                                                    backgroundColor: cat.color ? `${cat.color}20` : '#e5e7eb',
                                                                    color: cat.color || '#374151',
                                                                }}
                                                            >
                                                                Selected
                                                            </span>
                                                        )}
                                                        {!hasNoSubcategories && selectedCount > 0 && (
                                                            <span
                                                                className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold"
                                                                style={{
                                                                    backgroundColor: cat.color ? `${cat.color}20` : '#e5e7eb',
                                                                    color: cat.color || '#374151',
                                                                }}
                                                            >
                                                                {selectedCount}/{cat.subCategories.length}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* SubCategories as items inside folder */}
                                                    {subsToShow.length > 0 && (
                                                        <div className="ml-6">
                                                            {subsToShow.map((sub: any, subIndex: number) => {
                                                                const isSelected = formData.subCategories.includes(sub._id);
                                                                const isSubLast = subIndex === subsToShow.length - 1;

                                                                return (
                                                                    <button
                                                                        key={sub._id}
                                                                        type="button"
                                                                        onClick={() => toggleSubCategorySelection(sub._id)}
                                                                        className={`
                                                                            w-full flex items-center gap-2 py-2 px-3 rounded-lg transition-all text-left
                                                                            ${subCategorySearchTerm
                                                                                ? 'bg-yellow-100 border-2 border-yellow-400 hover:bg-yellow-200'
                                                                                : isSelected
                                                                                    ? 'bg-indigo-100 hover:bg-indigo-200'
                                                                                    : 'hover:bg-gray-100'
                                                                            }
                                                                        `}
                                                                    >
                                                                        <span className="text-gray-300 w-4">{isSubLast ? '└' : '├'}</span>

                                                                        {/* Checkbox */}
                                                                        <div
                                                                            className={`
                                                                                w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0
                                                                                ${isSelected
                                                                                    ? 'border-indigo-600 bg-indigo-600'
                                                                                    : 'border-gray-400 bg-white'
                                                                                }
                                                                            `}
                                                                        >
                                                                            {isSelected && (
                                                                                <svg className="w-3 h-3 text-white" viewBox="0 0 14 14" fill="none">
                                                                                    <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                                                </svg>
                                                                            )}
                                                                        </div>



                                                                        {/* SubCategory name */}
                                                                        <span
                                                                            className={`font-medium ${isSelected ? 'text-indigo-700' : 'text-gray-700'}`}
                                                                        >
                                                                            {sub.name}
                                                                        </span>
                                                                </button>
                                                                );
                                                            })}
                                                            
                                                            {/* "Others" option for this category */}
                                                            <div className="mt-1 pt-1 border-t border-gray-200">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        // Create a virtual "Others" ID for this category
                                                                        const othersId = `others_${cat._id}`;
                                                                        setFormData(prev => {
                                                                            const isSelected = prev.categories.includes(othersId);
                                                                            return {
                                                                                ...prev,
                                                                                categories: isSelected
                                                                                    ? prev.categories.filter(id => id !== othersId)
                                                                                    : [...prev.categories, othersId]
                                                                            };
                                                                        });
                                                                    }}
                                                                    className={`
                                                                        w-full flex items-center gap-2 py-2 px-3 rounded-lg transition-all text-left
                                                                        ${formData.categories.includes(`others_${cat._id}`)
                                                                            ? 'bg-gray-200 hover:bg-gray-300'
                                                                            : 'hover:bg-gray-100'
                                                                        }
                                                                    `}
                                                                >
                                                                    <span className="text-gray-300 w-4">└</span>
                                                                    
                                                                    {/* Checkbox */}
                                                                    <div
                                                                        className={`
                                                                            w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0
                                                                            ${formData.categories.includes(`others_${cat._id}`)
                                                                                ? 'border-gray-600 bg-gray-600'
                                                                                : 'border-gray-400 bg-white'
                                                                            }
                                                                        `}
                                                                    >
                                                                        {formData.categories.includes(`others_${cat._id}`) && (
                                                                            <svg className="w-3 h-3 text-white" viewBox="0 0 14 14" fill="none">
                                                                                <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                                            </svg>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    {/* "Others" label */}
                                                                    <span className="font-medium text-gray-500 italic">
                                                                        Others
                                                                    </span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}


                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-gray-200 bg-white flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-600 text-sm font-medium">
                                        {formData.subCategories.length + formData.categories.length} item{(formData.subCategories.length + formData.categories.length) !== 1 ? 's' : ''} selected
                                    </span>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setFormData(prev => ({ ...prev, subCategories: [], categories: [] }))}
                                        className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
                                    >
                                        Clear All
                                    </button>
                                    <button
                                        onClick={() => setIsChartPopupOpen(false)}
                                        className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-lg shadow-lg transition-all active:scale-95"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
