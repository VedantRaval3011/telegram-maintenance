// app/masters/categories/page.tsx (or wherever your CategoryMasterPage lives)
"use client";

import { useState } from "react";
import useSWR from "swr";
import Navbar from "@/components/Navbar";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const fetchSubCategories = async (categoryId: string) => {
  const res = await fetch(`/api/masters/subcategories?categoryId=${categoryId}`);
  const json = await res.json();
  return json.data || [];
};

interface Category {
  _id: string;
  name: string;
  displayName: string;
  keywords: string[];
  description?: string;
  color?: string;
  icon?: string;
  isActive: boolean;
  priority: number;
  subCount?: number;
  createdAt: string;
  updatedAt: string;
}

// Helper function to lighten a color
const lightenColor = (color: string, amount: number = 0.9) => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  const newR = Math.round(r + (255 - r) * amount);
  const newG = Math.round(g + (255 - g) * amount);
  const newB = Math.round(b + (255 - b) * amount);

  return `rgb(${newR}, ${newG}, ${newB})`;
};

export default function CategoryMasterPage() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showSubModal, setShowSubModal] = useState(false);
  const [subCategoryList, setSubCategoryList] = useState<any[]>([]);
  const [subCategoryCategoryId, setSubCategoryCategoryId] = useState<string | null>(null);

  const [subForm, setSubForm] = useState({
    name: "",
    icon: "",
    description: "",
    isActive: true,
  });

  const [editingSub, setEditingSub] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    keywords: "",
    description: "",
    color: "#7d6856",
    icon: "📋",
    priority: "0",
    isActive: true,
  });

  const queryParams = new URLSearchParams({
    limit: "50",
    ...(search && { search }),
    ...(activeFilter && { isActive: activeFilter }),
  });

  const { data, error, mutate } = useSWR(
    `/api/masters/categories?${queryParams}`,
    fetcher
  );

  const handleSeed = async () => {
    if (!confirm("Seed default categories? This will create: Electrical, Plumbing, Furniture, Cleaning, HVAC, Paint, and Other.")) return;

    try {
      const res = await fetch("/api/masters/categories/seed", {
        method: "POST",
      });

      const result = await res.json();
      if (res.ok) {
        mutate();
        alert(`Seeded successfully! Created: ${result.results.created}, Skipped: ${result.results.skipped}`);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      alert("Failed to seed categories");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;

    try {
      const res = await fetch(`/api/masters/categories/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        mutate();
        alert("Category deleted successfully");
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert("Failed to delete category");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch("/api/masters/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          keywords: formData.keywords.split(",").map((k) => k.trim()).filter(Boolean),
          priority: parseInt(formData.priority),
        }),
      });

      if (res.ok) {
        mutate();
        setShowCreateModal(false);
        setFormData({
          name: "",
          displayName: "",
          keywords: "",
          description: "",
          color: "#7d6856",
          icon: "📋",
          priority: "0",
          isActive: true,
        });
        alert("Category created successfully");
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert("Failed to create category");
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    try {
      const res = await fetch(`/api/masters/categories/${editingCategory._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: formData.displayName,
          keywords: formData.keywords.split(",").map((k) => k.trim()).filter(Boolean),
          description: formData.description,
          color: formData.color,
          icon: formData.icon,
          priority: parseInt(formData.priority),
          isActive: formData.isActive,
        }),
      });

      if (res.ok) {
        mutate();
        setShowEditModal(false);
        setEditingCategory(null);
        alert("Category updated successfully");
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert("Failed to update category");
    }
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      displayName: category.displayName,
      keywords: category.keywords.join(", "),
      description: category.description || "",
      color: category.color || "#7d6856",
      icon: category.icon || "📋",
      priority: category.priority.toString(),
      isActive: category.isActive,
    });
    setShowEditModal(true);
  };

  if (error) return <div className="p-10 text-center text-rose-500">Failed to load categories</div>;
  if (!data) return <div className="p-10 text-center text-gray-600 animate-pulse">Loading categories...</div>;

  const categories: Category[] = data.data || [];

  return (
    <div className="min-h-screen bg-white pb-20 font-sans">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-0">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
              Categories
            </h1>
            <p className="text-gray-600 mt-2 text-sm font-medium">
              Manage maintenance categories and keywords
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-green-600/20 transition-all active:scale-95"
            >
              + Create Category
            </button>
          </div>
        </div>



        {/* Categories Grid */}
        {categories.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="text-center py-16">
              <p className="text-gray-600 mb-4">No categories found</p>
              <button
                onClick={handleSeed}
                className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-bold shadow-lg"
              >
                🌱 Seed Default Categories
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => {
              const bgColor = lightenColor(category.color || "#7d6856", 0.92);
              const borderColor = category.color || "#7d6856";

              return (
                <div
                  key={category._id}
                  className="border-2 rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all group"
                  style={{
                    backgroundColor: bgColor,
                    borderColor: borderColor
                  }}
                >
                  <div className="p-6" style={{ borderLeft: `4px solid ${borderColor}` }}>
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{category.icon}</span>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {category.displayName}
                          </h3>
                          <p className="text-xs text-gray-600 font-mono">{category.name}</p>
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${category.isActive
                            ? "bg-green-600 text-white border-green-700"
                            : "bg-gray-400 border-gray-500 text-white"
                          }`}
                      >
                        {category.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    {/* Description */}
                    {category.description && (
                      <p className="text-sm text-gray-700 mb-4 line-clamp-2">
                        {category.description}
                      </p>
                    )}

                    {/* Meta Info */}
                    <div className="flex justify-between items-center text-xs text-gray-600 mb-4 pb-4 border-b border-gray-300">
                      <span className="font-medium">Priority: {category.priority}</span>
                      <span>
                        {new Date(category.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Subcategories Button */}
                    <button
                      onClick={async () => {
                        const subs = await fetchSubCategories(category._id);
                        setSubCategoryList(subs);
                        setSubCategoryCategoryId(category._id);
                        setShowSubModal(true);
                        setEditingSub(null);
                        setSubForm({ name: "", icon: "", description: "", isActive: true });
                      }}
                      className="w-full px-4 py-2.5 text-sm bg-white/70 text-gray-900 rounded-lg hover:bg-white border border-gray-300 transition-all font-medium mb-3"
                    >
                      🧩 Manage Subcategories ({category.subCount || 0})
                    </button>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(category)}
                        className="flex-1 px-4 py-2.5 text-sm bg-white/70 text-gray-900 rounded-lg hover:bg-white border border-gray-300 transition-all font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(category._id)}
                        className="flex-1 px-4 py-2.5 text-sm bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 border border-rose-200 transition-all font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">Create New Category</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5 max-h-[calc(90vh-100px)] overflow-y-auto">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Name (lowercase, no spaces) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s/g, "_") })
                    }
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.displayName}
                    onChange={(e) =>
                      setFormData({ ...formData, displayName: e.target.value })
                    }
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Keywords (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.keywords}
                    onChange={(e) =>
                      setFormData({ ...formData, keywords: e.target.value })
                    }
                    placeholder="light, bulb, power"
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Color
                  </label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                    className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Icon (emoji)
                  </label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) =>
                      setFormData({ ...formData, icon: e.target.value })
                    }
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Priority
                  </label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                  />
                </div>

                <div className="flex items-center pt-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) =>
                          setFormData({ ...formData, isActive: e.target.checked })
                        }
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 bg-gray-50 checked:bg-gray-900 checked:border-gray-900 transition-all"
                      />
                      <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" viewBox="0 0 14 14" fill="none">
                        <path d="M3 8L6 11L11 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Active Status</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 rounded-xl shadow-lg shadow-gray-900/20 transition-all active:scale-95"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">Edit Category</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCategory(null);
                }}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEdit} className="p-6 space-y-5 max-h-[calc(90vh-100px)] overflow-y-auto">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Name (read-only)
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.displayName}
                    onChange={(e) =>
                      setFormData({ ...formData, displayName: e.target.value })
                    }
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Keywords (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.keywords}
                    onChange={(e) =>
                      setFormData({ ...formData, keywords: e.target.value })
                    }
                    placeholder="light, bulb, power"
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Color
                  </label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                    className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Icon (emoji)
                  </label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) =>
                      setFormData({ ...formData, icon: e.target.value })
                    }
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Priority
                  </label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                  />
                </div>

                <div className="flex items-center pt-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) =>
                          setFormData({ ...formData, isActive: e.target.checked })
                        }
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 bg-gray-50 checked:bg-gray-900 checked:border-gray-900 transition-all"
                      />
                      <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" viewBox="0 0 14 14" fill="none">
                        <path d="M3 8L6 11L11 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Active Status</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingCategory(null);
                  }}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 rounded-xl shadow-lg shadow-gray-900/20 transition-all active:scale-95"
                >
                  Update Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBCATEGORY MODAL */}
      {showSubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">Manage Subcategories</h2>
              <button
                onClick={() => setShowSubModal(false)}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 max-h-[calc(90vh-100px)] overflow-y-auto">
              {/* List */}
              <div className="space-y-2 mb-6">
                {subCategoryList.length === 0 && (
                  <p className="text-gray-600 text-sm text-center py-4">No subcategories yet.</p>
                )}

                {subCategoryList.map((sub) => (
                  <div
                    key={sub._id}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-center hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{sub.icon || "🔹"} {sub.name}</div>
                      {sub.description && (
                        <div className="text-xs text-gray-600 mt-1">{sub.description}</div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingSub(sub);
                          setSubForm({
                            name: sub.name,
                            icon: sub.icon || "",
                            description: sub.description || "",
                            isActive: sub.isActive
                          });
                        }}
                        className="px-3 py-1.5 bg-gray-100 text-gray-900 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                      >
                        Edit
                      </button>

                      <button
                        onClick={async () => {
                          if (!confirm("Delete this subcategory?")) return;
                          await fetch(`/api/masters/subcategories/${sub._id}`, {
                            method: "DELETE",
                          });
                          const newList = await fetchSubCategories(subCategoryCategoryId!);
                          setSubCategoryList(newList);
                          mutate();
                        }}
                        className="px-3 py-1.5 bg-rose-100 text-rose-700 rounded-lg text-xs font-medium hover:bg-rose-200 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* CREATE / EDIT FORM */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-base font-semibold mb-4 text-gray-900">
                  {editingSub ? "Edit Subcategory" : "Add Subcategory"}
                </h3>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();

                    const payload = {
                      categoryId: subCategoryCategoryId,
                      name: subForm.name,
                      icon: subForm.icon,
                      description: subForm.description,
                      isActive: subForm.isActive,
                    };

                    if (editingSub) {
                      await fetch(`/api/masters/subcategories/${editingSub._id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      });
                    } else {
                      await fetch(`/api/masters/subcategories`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      });
                    }

                    const fresh = await fetchSubCategories(subCategoryCategoryId!);
                    setSubCategoryList(fresh);
                    setEditingSub(null);
                    setSubForm({ name: "", icon: "", description: "", isActive: true });
                    mutate();
                  }}
                  className="space-y-4"
                >
                  <input
                    type="text"
                    placeholder="Name *"
                    required
                    value={subForm.name}
                    onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                  />

                  <input
                    type="text"
                    placeholder="Icon (emoji)"
                    value={subForm.icon}
                    onChange={(e) => setSubForm({ ...subForm, icon: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                  />

                  <textarea
                    placeholder="Description"
                    value={subForm.description}
                    onChange={(e) => setSubForm({ ...subForm, description: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all resize-none"
                    rows={2}
                  />

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={subForm.isActive}
                        onChange={(e) =>
                          setSubForm({ ...subForm, isActive: e.target.checked })
                        }
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 bg-gray-50 checked:bg-gray-900 checked:border-gray-900 transition-all"
                      />
                      <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" viewBox="0 0 14 14" fill="none">
                        <path d="M3 8L6 11L11 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">Active Status</span>
                  </label>

                  <div className="flex justify-end gap-3 pt-2">
                    {editingSub && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSub(null);
                          setSubForm({ name: "", icon: "", description: "", isActive: true });
                        }}
                        className="px-4 py-2 bg-gray-100 rounded-lg text-gray-900 hover:bg-gray-200 font-medium transition-colors"
                      >
                        Cancel Edit
                      </button>
                    )}

                    <button
                      type="submit"
                      className="px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-bold transition-all active:scale-95"
                    >
                      {editingSub ? "Update" : "Add"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}