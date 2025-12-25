// app/masters/users/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import Navbar from "@/components/Navbar";
import { toast } from "react-hot-toast";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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

interface User {
  _id: string;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
  source: string;
  locationId?: any;
  subCategories?: ISubCategory[];
  lastSeenAt: string;
  lastSyncedAt: string;
}

// Stat Card Component
function StatCard({
  label,
  value,
  icon,
  color = "blue",
  subValue,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color?: "blue" | "green" | "purple" | "cyan" | "orange";
  subValue?: string;
}) {
  const colors = {
    blue: {
      bg: "bg-gradient-to-br from-blue-50 to-blue-100/50",
      border: "border-blue-200/60",
      text: "text-blue-700",
      iconBg: "bg-blue-500",
    },
    green: {
      bg: "bg-gradient-to-br from-emerald-50 to-emerald-100/50",
      border: "border-emerald-200/60",
      text: "text-emerald-700",
      iconBg: "bg-emerald-500",
    },
    purple: {
      bg: "bg-gradient-to-br from-purple-50 to-purple-100/50",
      border: "border-purple-200/60",
      text: "text-purple-700",
      iconBg: "bg-purple-500",
    },
    cyan: {
      bg: "bg-gradient-to-br from-cyan-50 to-cyan-100/50",
      border: "border-cyan-200/60",
      text: "text-cyan-700",
      iconBg: "bg-cyan-500",
    },
    orange: {
      bg: "bg-gradient-to-br from-orange-50 to-orange-100/50",
      border: "border-orange-200/60",
      text: "text-orange-700",
      iconBg: "bg-orange-500",
    },
  };

  const c = colors[color];

  return (
    <div
      className={`${c.bg} ${c.border} border rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
          <p className={`text-3xl font-bold ${c.text}`}>{value}</p>
          {subValue && (
            <p className="text-xs text-gray-400 mt-1">{subValue}</p>
          )}
        </div>
        <div
          className={`${c.iconBg} w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

// Role Badge Component
function RoleBadge({ role }: { role: string }) {
  const roleStyles: Record<string, string> = {
    creator:
      "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border border-amber-200",
    administrator:
      "bg-gradient-to-r from-purple-100 to-violet-100 text-purple-800 border border-purple-200",
    member:
      "bg-gradient-to-r from-blue-100 to-sky-100 text-blue-800 border border-blue-200",
  };

  const style = roleStyles[role] || roleStyles.member;

  return (
    <span
      className={`${style} px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5`}
    >
      {role === "creator" && (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )}
      {role === "administrator" && (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {role === "member" && (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <span className="capitalize">{role || "member"}</span>
    </span>
  );
}

// Source Badge Component
function SourceBadge({ source }: { source: string }) {
  const sourceStyles: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    webhook: {
      bg: "bg-gradient-to-r from-green-100 to-emerald-100",
      text: "text-green-700",
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    admin_sync: {
      bg: "bg-gradient-to-r from-purple-100 to-violet-100",
      text: "text-purple-700",
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    manual: {
      bg: "bg-gradient-to-r from-gray-100 to-slate-100",
      text: "text-gray-700",
      icon: (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
      ),
    },
  };

  const style = sourceStyles[source] || sourceStyles.manual;

  return (
    <span
      className={`${style.bg} ${style.text} px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 border border-gray-200/50`}
    >
      {style.icon}
      <span className="capitalize">{source.replace("_", " ")}</span>
    </span>
  );
}

// User Avatar Component
function UserAvatar({ user }: { user: User }) {
  const initials = user.firstName
    ? user.firstName[0].toUpperCase()
    : user.username
      ? user.username[0].toUpperCase()
      : "U";

  const colors = [
    "from-blue-400 to-blue-600",
    "from-purple-400 to-purple-600",
    "from-emerald-400 to-emerald-600",
    "from-rose-400 to-rose-600",
    "from-amber-400 to-amber-600",
    "from-cyan-400 to-cyan-600",
  ];

  // Generate consistent color based on telegram ID
  const colorIndex = Math.abs(user.telegramId) % colors.length;
  const gradient = colors[colorIndex];

  return (
    <div
      className={`w-11 h-11 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-semibold text-sm shadow-md ring-2 ring-white`}
    >
      {initials}
    </div>
  );
}

export default function UserMasterPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Sync from Telegram state
  const [syncing, setSyncing] = useState(false);

  // Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isChartPopupOpen, setIsChartPopupOpen] = useState(false);
  const [subCategorySearchTerm, setSubCategorySearchTerm] = useState("");

  // Categories and subcategories
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [allSubCategories, setAllSubCategories] = useState<ISubCategory[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    phone: "",
    subCategories: [] as string[],
    categories: [] as string[],
  });

  // Add User Modal state
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [addUserFormData, setAddUserFormData] = useState({
    username: "",
    firstName: "",
    lastName: "",
    phone: "",
  });
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Fetch categories and subcategories
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, subRes] = await Promise.all([
          fetch("/api/masters/categories"),
          fetch("/api/masters/subcategories"),
        ]);
        const catData = await catRes.json();
        const subData = await subRes.json();
        if (catData.success) setCategories(catData.data);
        if (subData.success) setAllSubCategories(subData.data);
      } catch (err) {
        console.error("Failed to fetch categories/subcategories", err);
      }
    };
    fetchData();
  }, []);

  // Build hierarchical structure
  const categoryTree = useMemo(() => {
    return categories.map(cat => ({
      ...cat,
      subCategories: allSubCategories.filter(sub => {
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

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: "20",
    ...(search && { search }),
    ...(roleFilter && { role: roleFilter }),
    ...(sourceFilter && { source: sourceFilter }),
  });

  const { data, error, mutate } = useSWR(
    `/api/masters/users?${queryParams}`,
    fetcher
  );

  const handleOpenModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      phone: user.phone || "",
      subCategories: user.subCategories?.map(s => s._id) || [],
      categories: [],
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingUser) return;

    try {
      const res = await fetch("/api/masters/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _id: editingUser._id,
          phone: formData.phone,
          subCategories: formData.subCategories,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("User updated successfully");
        setIsModalOpen(false);
        setIsChartPopupOpen(false);
        mutate();
      } else {
        toast.error(data.error || "Failed to update user");
      }
    } catch (err) {
      console.error("Error saving user", err);
      toast.error("An error occurred");
    }
  };

  const toggleSubCategorySelection = (subId: string) => {
    setFormData(prev => ({
      ...prev,
      subCategories: prev.subCategories.includes(subId)
        ? prev.subCategories.filter(id => id !== subId)
        : [...prev.subCategories, subId]
    }));
  };

  const toggleCategorySelection = (catId: string) => {
    const subsInCategory = allSubCategories
      .filter(sub => {
        let subCatId: string | null = null;
        if (typeof sub.categoryId === 'string') {
          subCatId = sub.categoryId;
        } else if (sub.categoryId && typeof sub.categoryId === 'object') {
          subCatId = (sub.categoryId as ICategory)._id;
        }
        return subCatId === catId;
      })
      .map(sub => sub._id);

    if (subsInCategory.length === 0) {
      setFormData(prev => ({
        ...prev,
        categories: prev.categories.includes(catId)
          ? prev.categories.filter(id => id !== catId)
          : [...prev.categories, catId]
      }));
      return;
    }

    setFormData(prev => {
      const allSelected = subsInCategory.every(subId => prev.subCategories.includes(subId));
      if (allSelected) {
        return { ...prev, subCategories: prev.subCategories.filter(id => !subsInCategory.includes(id)) };
      } else {
        const newSelection = [...prev.subCategories];
        subsInCategory.forEach(subId => {
          if (!newSelection.includes(subId)) newSelection.push(subId);
        });
        return { ...prev, subCategories: newSelection };
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const res = await fetch(`/api/masters/users/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        mutate();
        alert("User deleted successfully");
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert("Failed to delete user");
    }
  };

  const handleSyncFromTelegram = async () => {
    if (!confirm("Sync users from the configured Telegram group?\n\nThis will fetch all administrators from the group.")) {
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch("/api/masters/users/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // Uses TELEGRAM_SYNC_CHAT_ID from env
      });

      const data = await res.json();

      if (data.success) {
        alert(`✅ ${data.message}\n\nCreated: ${data.data.created}\nUpdated: ${data.data.updated}`);
        mutate(); // Refresh the users list
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      alert("Failed to sync users from Telegram");
    } finally {
      setSyncing(false);
    }
  };

  // Handle Add User
  const handleAddUser = async () => {
    if (!addUserFormData.username && !addUserFormData.firstName) {
      toast.error("Please enter at least a username or first name");
      return;
    }

    setIsAddingUser(true);
    try {
      // Generate a unique telegramId for manual users (negative to avoid conflicts with real IDs)
      const manualTelegramId = -Math.floor(Date.now() + Math.random() * 10000);

      const res = await fetch("/api/masters/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: manualTelegramId,
          username: addUserFormData.username || undefined,
          firstName: addUserFormData.firstName || undefined,
          lastName: addUserFormData.lastName || undefined,
          phone: addUserFormData.phone || undefined,
          role: "member",
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("User added successfully!");
        setIsAddUserModalOpen(false);
        setAddUserFormData({ username: "", firstName: "", lastName: "", phone: "" });
        mutate();
      } else {
        toast.error(data.error || "Failed to add user");
      }
    } catch (err) {
      console.error("Error adding user", err);
      toast.error("An error occurred while adding user");
    } finally {
      setIsAddingUser(false);
    }
  };

  const hasActiveFilters = search || roleFilter || sourceFilter;

  if (error)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Failed to load users
          </h2>
          <p className="text-gray-500">Please try refreshing the page</p>
        </div>
      </div>
    );

  if (!data)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Loading users...</p>
        </div>
      </div>
    );

  const users: User[] = data.data || [];
  const pagination = data.pagination;

  // Calculate role statistics
  const roleStats = {
    creators: users.filter((u) => u.role === "creator").length,
    admins: users.filter((u) => u.role === "administrator").length,
    members: users.filter(
      (u) => u.role === "member" || !u.role
    ).length,
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">

                User Management
              </h1>
              <p className="text-gray-500">
                Manage Telegram users synced from groups and webhooks
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Add User Button */}
              <button
                onClick={() => setIsAddUserModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all border shadow-sm bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                  />
                </svg>
                Add User
              </button>

              <button
                onClick={handleSyncFromTelegram}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all border shadow-sm bg-blue-600 text-white border-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                )}
                {syncing ? "Syncing..." : "Sync from Telegram"}
              </button>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all border shadow-sm ${showFilters
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
                Filters
                {hasActiveFilters && (
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                )}
              </button>

              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setSearch("");
                    setRoleFilter("");
                    setSourceFilter("");
                    setPage(1);
                  }}
                  className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-all border border-red-200"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard
            label="Total Users"
            value={pagination?.total || 0}
            color="blue"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            }
          />
          <StatCard
            label="Administrators"
            value={roleStats.admins}
            color="purple"
            subValue="With special permissions"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            }
          />
          <StatCard
            label="Creators"
            value={roleStats.creators}
            color="orange"
            subValue="Group owners"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            }
          />
          <StatCard
            label="On This Page"
            value={users.length}
            color="cyan"
            subValue={`Page ${page} of ${pagination?.totalPages || 1}`}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            }
          />
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8 shadow-sm animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search
                </label>
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by name or username..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="input-base pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setPage(1);
                  }}
                  className="input-base"
                >
                  <option value="">All Roles</option>
                  <option value="creator">Creator</option>
                  <option value="administrator">Administrator</option>
                  <option value="member">Member</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Source
                </label>
                <select
                  value={sourceFilter}
                  onChange={(e) => {
                    setSourceFilter(e.target.value);
                    setPage(1);
                  }}
                  className="input-base"
                >
                  <option value="">All Sources</option>
                  <option value="webhook">Webhook</option>
                  <option value="admin_sync">Admin Sync</option>
                  <option value="manual">Manual</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearch("");
                    setRoleFilter("");
                    setSourceFilter("");
                    setPage(1);
                  }}
                  className="w-full px-4 py-2.5 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Reset Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Users List</h3>
              <span className="text-sm text-gray-500">
                Showing {users.length} of {pagination?.total || 0} users
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Telegram ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    SubCategories
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Last Seen
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user, index) => (
                  <tr
                    key={user._id}
                    className="hover:bg-blue-50/30 transition-colors group"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={user} />
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {user.firstName || user.lastName
                              ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                              : "Unknown User"}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <span className="text-gray-400">@</span>
                            {user.username || "no_username"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded-md font-mono">
                        {user.telegramId}
                      </code>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.phone ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {user.phone}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Not set</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {user.subCategories && user.subCategories.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {user.subCategories.slice(0, 3).map((sub) => {
                            const cat = typeof sub.categoryId === 'object' ? sub.categoryId as ICategory : null;
                            return (
                              <span
                                key={sub._id}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: cat?.color ? `${cat.color}15` : '#f3f4f6',
                                  color: cat?.color || '#6b7280',
                                  border: `1px solid ${cat?.color ? `${cat.color}30` : '#e5e7eb'}`
                                }}
                              >
                                {sub.name}
                              </span>
                            );
                          })}
                          {user.subCategories.length > 3 && (
                            <span className="text-xs text-gray-500">+{user.subCategories.length - 3} more</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">None</span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <RoleBadge role={user.role || "member"} />
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <SourceBadge source={user.source} />
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.locationId?.name ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          {user.locationId.name}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Not assigned</span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.lastSeenAt ? (
                        <div className="text-sm">
                          <div className="text-gray-700">
                            {new Date(user.lastSeenAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          <div className="text-gray-400 text-xs">
                            {new Date(user.lastSeenAt).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Never</span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(user)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-blue-600 hover:text-white hover:bg-blue-500 rounded-lg text-sm font-medium transition-all opacity-0 group-hover:opacity-100"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(user._id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:text-white hover:bg-red-500 rounded-lg text-sm font-medium transition-all opacity-0 group-hover:opacity-100"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {users.length === 0 && (
            <div className="py-16 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No users found</h3>
              <p className="text-gray-500">
                {hasActiveFilters
                  ? "Try adjusting your filters"
                  : "Users will appear here once synced"}
              </p>
            </div>
          )}

          {/* Premium Pagination */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Page <span className="font-semibold text-gray-900">{page}</span> of{" "}
                <span className="font-semibold text-gray-900">{pagination?.totalPages || 1}</span>
                <span className="mx-2 text-gray-300">•</span>
                <span className="font-semibold text-gray-900">{pagination?.total || 0}</span> total users
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  title="First page"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>

                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium text-sm shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>

                <button
                  onClick={() => setPage(Math.min(pagination?.totalPages || 1, page + 1))}
                  disabled={page === (pagination?.totalPages || 1)}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium text-sm shadow-sm"
                >
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  onClick={() => setPage(pagination?.totalPages || 1)}
                  disabled={page === (pagination?.totalPages || 1)}
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  title="Last page"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Edit User Modal */}
        {isModalOpen && editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm overflow-hidden">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 max-h-[90vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h2 className="text-lg font-bold text-gray-900">
                  Edit User - {editingUser.firstName || editingUser.username || "User"}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-600 hover:text-gray-900 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Enter phone number"
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                  />
                </div>

                {/* Link SubCategories Button */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                    Assign SubCategories
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsChartPopupOpen(true)}
                    className="w-full p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-dashed border-indigo-300 rounded-xl text-indigo-700 hover:border-indigo-400 hover:from-indigo-100 hover:to-purple-100 transition-all flex items-center justify-center gap-3 group"
                  >
                    <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    <span className="font-semibold">
                      {formData.subCategories.length > 0
                        ? `${formData.subCategories.length} SubCategor${formData.subCategories.length === 1 ? 'y' : 'ies'} Selected`
                        : "Select SubCategories"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
                <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                <button onClick={handleSave} className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl shadow-lg shadow-gray-900/20 transition-all flex items-center gap-2 active:scale-95">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chart Popup - Subcategory Selection */}
        {isChartPopupOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-200 max-h-[90vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-800">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                  <div>
                    <h2 className="text-lg font-bold text-white">Assign SubCategories</h2>
                    <p className="text-gray-400 text-xs">Click on subcategories to select/deselect</p>
                  </div>
                </div>
                <button onClick={() => setIsChartPopupOpen(false)} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-4 border-b border-gray-200 bg-white">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input
                    type="text"
                    placeholder="Search..."
                    value={subCategorySearchTerm}
                    onChange={(e) => setSubCategorySearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="p-4 overflow-y-auto flex-1 bg-gray-50">
                <div className="space-y-1 font-mono text-sm">
                  {categoryTree.map((cat, catIndex) => {
                    const categoryMatches = cat.displayName.toLowerCase().includes(subCategorySearchTerm.toLowerCase());
                    const matchingSubs = cat.subCategories.filter(sub => sub.name.toLowerCase().includes(subCategorySearchTerm.toLowerCase()));
                    if (subCategorySearchTerm && !categoryMatches && matchingSubs.length === 0) return null;
                    const subsToShow = subCategorySearchTerm && !categoryMatches ? matchingSubs : cat.subCategories;
                    const selectedCount = cat.subCategories.filter(s => formData.subCategories.includes(s._id)).length;
                    const isLast = catIndex === categoryTree.length - 1;

                    return (
                      <div key={cat._id} className="select-none">
                        <div className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-100">
                          <span className="text-gray-400 w-4">{isLast ? '└' : '├'}</span>
                          <button type="button" onClick={() => toggleCategorySelection(cat._id)} className={`w-4 h-4 rounded border-2 flex items-center justify-center ${selectedCount === cat.subCategories.length && selectedCount > 0 ? 'border-indigo-600 bg-indigo-600' : selectedCount > 0 ? 'border-indigo-400 bg-indigo-200' : 'border-gray-400 bg-white'}`}>
                            {selectedCount === cat.subCategories.length && selectedCount > 0 && <svg className="w-3 h-3 text-white" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                          </button>
                          <span className="text-yellow-500 text-lg">📁</span>
                          <span className="font-semibold" style={{ color: cat.color || '#374151' }}>{cat.displayName}</span>
                          {selectedCount > 0 && <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: cat.color ? `${cat.color}20` : '#e5e7eb', color: cat.color || '#374151' }}>{selectedCount}/{cat.subCategories.length}</span>}
                        </div>
                        {subsToShow.length > 0 && (
                          <div className="ml-6">
                            {subsToShow.map((sub, subIndex) => {
                              const isSelected = formData.subCategories.includes(sub._id);
                              return (
                                <button key={sub._id} type="button" onClick={() => toggleSubCategorySelection(sub._id)} className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg transition-all text-left ${isSelected ? 'bg-indigo-100 hover:bg-indigo-200' : 'hover:bg-gray-100'}`}>
                                  <span className="text-gray-300 w-4">{subIndex === subsToShow.length - 1 ? '└' : '├'}</span>
                                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-400 bg-white'}`}>
                                    {isSelected && <svg className="w-3 h-3 text-white" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                  </div>
                                  <span className={`font-medium ${isSelected ? 'text-indigo-700' : 'text-gray-700'}`}>{sub.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 bg-white flex items-center justify-between">
                <span className="text-gray-600 text-sm font-medium">{formData.subCategories.length} item{formData.subCategories.length !== 1 ? 's' : ''} selected</span>
                <div className="flex gap-3">
                  <button onClick={() => setFormData(prev => ({ ...prev, subCategories: [] }))} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Clear All</button>
                  <button onClick={() => setIsChartPopupOpen(false)} className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-lg shadow-lg active:scale-95">Done</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add User Modal */}
        {isAddUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm overflow-hidden">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-green-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Add New User</h2>
                      <p className="text-xs text-gray-500">Manually add a user for Telegram access</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsAddUserModalOpen(false);
                      setAddUserFormData({ username: "", firstName: "", lastName: "", phone: "" });
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-100 rounded-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <div className="p-6 space-y-4">
                {/* Username */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    <svg className="w-4 h-4 inline-block mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                    Username
                  </label>
                  <input
                    type="text"
                    value={addUserFormData.username}
                    onChange={(e) => setAddUserFormData({ ...addUserFormData, username: e.target.value.replace(/^@/, '') })}
                    placeholder="e.g., john_doe (without @)"
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none transition-all placeholder:text-gray-400"
                  />
                </div>

                {/* First Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    <svg className="w-4 h-4 inline-block mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    First Name
                  </label>
                  <input
                    type="text"
                    value={addUserFormData.firstName}
                    onChange={(e) => setAddUserFormData({ ...addUserFormData, firstName: e.target.value })}
                    placeholder="e.g., John"
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none transition-all placeholder:text-gray-400"
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={addUserFormData.lastName}
                    onChange={(e) => setAddUserFormData({ ...addUserFormData, lastName: e.target.value })}
                    placeholder="e.g., Doe (optional)"
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none transition-all placeholder:text-gray-400"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    <svg className="w-4 h-4 inline-block mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={addUserFormData.phone}
                    onChange={(e) => setAddUserFormData({ ...addUserFormData, phone: e.target.value })}
                    placeholder="e.g., 919876543210"
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none transition-all placeholder:text-gray-400"
                  />
                  <p className="text-xs text-gray-500 mt-1.5">Include country code without + sign</p>
                </div>

                {/* Info Note */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-blue-700">
                    This user will be added as a <strong>Manual</strong> source user. They will appear in the user list and can be assigned subcategories for receiving relevant ticket notifications.
                  </p>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsAddUserModalOpen(false);
                    setAddUserFormData({ username: "", firstName: "", lastName: "", phone: "" });
                  }}
                  className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddUser}
                  disabled={isAddingUser || (!addUserFormData.username && !addUserFormData.firstName)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAddingUser ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Adding...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add User
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}