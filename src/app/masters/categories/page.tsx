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
    color: "#6B7280",
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
          color: "#6B7280",
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
      color: category.color || "#6B7280",
      icon: category.icon || "📋",
      priority: category.priority.toString(),
      isActive: category.isActive,
    });
    setShowEditModal(true);
  };

  if (error) return <div className="p-6">Failed to load categories</div>;
  if (!data) return <div className="p-6">Loading...</div>;

  const categories: Category[] = data.data || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-950 via-stone-900 to-neutral-950 p-6">
      {/* NAVBAR ADDED */}
      <Navbar />

      <div className="mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2 text-amber-100">Category Master</h1>
          <p className="text-amber-200/70">Manage maintenance categories and keywords</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSeed}
            className="px-4 py-2 bg-emerald-700 text-white rounded-md hover:bg-emerald-600 transition-colors"
          >
            🌱 Seed Defaults
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-500 transition-colors"
          >
            + Create Category
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-stone-800/50 backdrop-blur-sm border border-amber-900/30 rounded-xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-amber-200 mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Name, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-stone-900/50 border border-amber-900/30 rounded-md text-amber-100 placeholder-amber-700 focus:ring-2 focus:ring-amber-600 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="input-base"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearch("");
                setActiveFilter("");
              }}
              className="px-4 py-2 text-amber-200 bg-stone-800 rounded-md hover:bg-stone-700 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((category) => (
          <div
            key={category._id}
            className="bg-gradient-to-br from-stone-800 to-stone-900 rounded-lg shadow-xl border border-amber-900/20 p-6 hover:shadow-2xl hover:border-amber-700/40 transition-all"
            style={{ borderLeft: `4px solid ${category.color}` }}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{category.icon}</span>
                <div>
                  <h3 className="text-lg font-bold text-amber-100">
                    {category.displayName}
                  </h3>
                  <p className="text-sm text-amber-300/70">{category.name}</p>
                </div>
              </div>
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  category.isActive
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {category.isActive ? "Active" : "Inactive"}
              </span>
            </div>

            {category.description && (
              <p className="text-sm text-amber-200/80 mb-3">{category.description}</p>
            )}

            <div className="mb-3">
              <div className="text-xs font-medium text-amber-300 mb-1">Keywords:</div>
              <div className="flex flex-wrap gap-1">
                {category.keywords.length > 0 ? (
                  category.keywords.map((keyword, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 text-xs bg-amber-900/30 text-amber-200 rounded border border-amber-700/30"
                    >
                      {keyword}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-amber-500/50">No keywords</span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center text-xs text-amber-300/70 mb-3">
              <span>Priority: {category.priority}</span>
              <span>
                {new Date(category.createdAt).toLocaleDateString()}
              </span>
            </div>

            <div className="mt-4">
              <button
                onClick={async () => {
                  const subs = await fetchSubCategories(category._id);
                  setSubCategoryList(subs);
                  setSubCategoryCategoryId(category._id);
                  setShowSubModal(true);
                  setEditingSub(null);
                  setSubForm({ name: "", icon: "", description: "", isActive: true });
                }}
                className="w-full px-3 py-2 text-sm bg-purple-900/30 text-purple-300 rounded hover:bg-purple-800/40 border border-purple-700/30 transition-colors"
              >
                🧩 Manage Subcategories ({category.subCount || 0})
              </button>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => openEditModal(category)}
                className="flex-1 px-3 py-2 text-sm bg-blue-900/30 text-blue-300 rounded hover:bg-blue-800/40 border border-blue-700/30 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(category._id)}
                className="flex-1 px-3 py-2 text-sm bg-red-900/30 text-red-300 rounded hover:bg-red-800/40 border border-red-700/30 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12 bg-stone-800/50 border border-amber-900/30 rounded-lg">
          <p className="text-amber-300/70 mb-4">No categories found</p>
          <button
            onClick={handleSeed}
            className="px-4 py-2 bg-emerald-700 text-white rounded-md hover:bg-emerald-600 transition-colors"
          >
            🌱 Seed Default Categories
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto border-2 border-gray-200 shadow-xl">
            <h2 className="text-2xl font-bold mb-4">Create New Category</h2>
            <form onSubmit={handleCreate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name (lowercase, no spaces) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s/g, "_") })
                    }
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.displayName}
                    onChange={(e) =>
                      setFormData({ ...formData, displayName: e.target.value })
                    }
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Keywords (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.keywords}
                    onChange={(e) =>
                      setFormData({ ...formData, keywords: e.target.value })
                    }
                    placeholder="light, bulb, power"
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={2}
                    className="input-base"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Color
                    </label>
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className="w-full h-10 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Icon (emoji)
                    </label>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) =>
                        setFormData({ ...formData, icon: e.target.value })
                      }
                      className="input-base"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority (higher = more important)
                  </label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    className="input-base"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="isActive"
                    className="ml-2 block text-sm text-gray-900"
                  >
                    Active
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingCategory && (
        <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto border-2 border-gray-200 shadow-xl">
            <h2 className="text-2xl font-bold mb-4">Edit Category</h2>
            <form onSubmit={handleEdit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name (read-only)
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.displayName}
                    onChange={(e) =>
                      setFormData({ ...formData, displayName: e.target.value })
                    }
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Keywords (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.keywords}
                    onChange={(e) =>
                      setFormData({ ...formData, keywords: e.target.value })
                    }
                    placeholder="light, bulb, power"
                    className="input-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={2}
                    className="input-base"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Color
                    </label>
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className="w-full h-10 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Icon (emoji)
                    </label>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) =>
                        setFormData({ ...formData, icon: e.target.value })
                      }
                      className="input-base"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority (higher = more important)
                  </label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    className="input-base"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActiveEdit"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="isActiveEdit"
                    className="ml-2 block text-sm text-gray-900"
                  >
                    Active
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingCategory(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBCATEGORY MODAL */}
      {showSubModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto shadow-xl border border-gray-200">

            <h2 className="text-xl font-bold mb-3">Manage Subcategories</h2>

            {/* List */}
            <div className="space-y-2 mb-4">
              {subCategoryList.length === 0 && (
                <p className="text-gray-500 text-sm">No subcategories yet.</p>
              )}

              {subCategoryList.map((sub) => (
                <div
                  key={sub._id}
                  className="p-3 bg-gray-50 rounded border flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium">{sub.icon || "🔹"} {sub.name}</div>
                    {sub.description && (
                      <div className="text-xs text-gray-500">{sub.description}</div>
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
                      className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs"
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
                        mutate(); // refresh category grid counts
                      }}
                      className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* CREATE / EDIT FORM */}
            <h3 className="text-lg font-semibold mb-2">
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
                mutate(); // refresh category grid counts
              }}
              className="space-y-3"
            >
              <input
                type="text"
                placeholder="Name"
                required
                value={subForm.name}
                onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
                className="input-base"
              />

              <input
                type="text"
                placeholder="Icon (emoji)"
                value={subForm.icon}
                onChange={(e) => setSubForm({ ...subForm, icon: e.target.value })}
                className="input-base"
              />

              <textarea
                placeholder="Description"
                value={subForm.description}
                onChange={(e) => setSubForm({ ...subForm, description: e.target.value })}
                className="input-base"
                rows={2}
              />

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={subForm.isActive}
                  onChange={(e) =>
                    setSubForm({ ...subForm, isActive: e.target.checked })
                  }
                />
                Active
              </label>

              <div className="flex justify-end gap-2">
                {editingSub && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSub(null);
                      setSubForm({ name: "", icon: "", description: "", isActive: true });
                    }}
                    className="px-3 py-2 bg-gray-100 rounded"
                  >
                    Cancel Edit
                  </button>
                )}

                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  {editingSub ? "Update" : "Add"}
                </button>
              </div>
            </form>

            {/* CLOSE */}
            <button
              onClick={() => setShowSubModal(false)}
              className="mt-4 w-full px-4 py-2 bg-gray-200 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
