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
    Bell,
    User,
    Building2,
    Clock,
    Calendar,
    MessageSquare,
    Activity,
    CheckCircle,
    XCircle,
    Eye,
    RefreshCw,
} from "lucide-react";
import { toast } from "react-hot-toast";

interface IUser {
    _id: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    phone?: string;
}

interface IAgency {
    _id: string;
    name: string;
    phone?: string;
}

interface ISubCategory {
    _id: string;
    name: string;
}

interface INotificationRule {
    _id: string;
    type: "user" | "agency";
    userId?: IUser;
    agencyId?: IAgency;
    subCategoryIds?: ISubCategory[];
    notifyBeforeDays?: number;
    reminderAfterHours?: number;
    maxReminders?: number;
    whatsappTemplateId?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

interface INotificationLog {
    _id: string;
    ticketId?: { ticketId: string; description: string };
    userId?: IUser;
    agencyId?: IAgency;
    recipientPhone: string;
    type: "first" | "reminder" | "before_visit" | "missed_visit";
    deliveryStatus: "pending" | "sent" | "delivered" | "read" | "failed";
    replied: boolean;
    replyContent?: string;
    sentAt: string;
    deliveredAt?: string;
    readAt?: string;
}

export default function NotificationMasterPage() {
    const [rules, setRules] = useState<INotificationRule[]>([]);
    const [logs, setLogs] = useState<INotificationLog[]>([]);
    const [users, setUsers] = useState<IUser[]>([]);
    const [agencies, setAgencies] = useState<IAgency[]>([]);
    const [subCategories, setSubCategories] = useState<ISubCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"rules" | "logs">("rules");
    const [searchTerm, setSearchTerm] = useState("");

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<INotificationRule | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        type: "user" as "user" | "agency",
        userId: "",
        agencyId: "",
        subCategoryIds: [] as string[],
        notifyBeforeDays: 1,
        reminderAfterHours: 12,
        maxReminders: 3,
        whatsappTemplateId: "",
        active: true,
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [rulesRes, logsRes, usersRes, agenciesRes, subcatsRes] = await Promise.all([
                fetch("/api/masters/notifications"),
                fetch("/api/notifications/logs?limit=100"),
                fetch("/api/masters/users"),
                fetch("/api/masters/agencies"),
                fetch("/api/masters/subcategories"),
            ]);

            const [rulesData, logsData, usersData, agenciesData, subcatsData] = await Promise.all([
                rulesRes.json(),
                logsRes.json(),
                usersRes.json(),
                agenciesRes.json(),
                subcatsRes.json(),
            ]);

            if (rulesData.ok) setRules(rulesData.data);
            if (logsData.ok) setLogs(logsData.data);
            if (usersData.success) setUsers(usersData.data);
            if (agenciesData.success) setAgencies(agenciesData.data);
            if (subcatsData.success) setSubCategories(subcatsData.data);
        } catch (error) {
            console.error("Failed to fetch data", error);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (rule?: INotificationRule) => {
        if (rule) {
            setEditingRule(rule);
            setFormData({
                type: rule.type,
                userId: (rule.userId as any)?._id || "",
                agencyId: (rule.agencyId as any)?._id || "",
                subCategoryIds: rule.subCategoryIds?.map((s: any) => s._id) || [],
                notifyBeforeDays: rule.notifyBeforeDays || 1,
                reminderAfterHours: rule.reminderAfterHours || 12,
                maxReminders: rule.maxReminders || 3,
                whatsappTemplateId: rule.whatsappTemplateId || "",
                active: rule.active,
            });
        } else {
            setEditingRule(null);
            setFormData({
                type: "user",
                userId: "",
                agencyId: "",
                subCategoryIds: [],
                notifyBeforeDays: 1,
                reminderAfterHours: 12,
                maxReminders: 3,
                whatsappTemplateId: "",
                active: true,
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (formData.type === "user" && !formData.userId) {
            toast.error("Please select a user");
            return;
        }
        if (formData.type === "agency" && !formData.agencyId) {
            toast.error("Please select an agency");
            return;
        }

        try {
            const payload = {
                ...formData,
                id: editingRule?._id,
            };

            const method = editingRule ? "PATCH" : "POST";
            const res = await fetch("/api/masters/notifications", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (data.ok) {
                toast.success(editingRule ? "Rule updated" : "Rule created");
                setIsModalOpen(false);
                fetchData();
            } else {
                toast.error(data.error || "Failed to save");
            }
        } catch (error) {
            console.error("Error saving rule", error);
            toast.error("An error occurred");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to deactivate this rule?")) return;

        try {
            const res = await fetch(`/api/masters/notifications?id=${id}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (data.ok) {
                toast.success("Rule deactivated");
                fetchData();
            } else {
                toast.error(data.error || "Failed to delete");
            }
        } catch (error) {
            toast.error("Error deleting rule");
        }
    };

    const triggerScheduler = async () => {
        try {
            toast.loading("Running scheduler...", { id: "scheduler" });
            const res = await fetch("/api/cron/notifications");
            const data = await res.json();
            if (data.ok) {
                toast.success(
                    `Scheduler completed! Sent: ${data.result.pendingReminders.sent + data.result.agencyVisitReminders.sent + data.result.missedVisitAlerts.sent}`,
                    { id: "scheduler" }
                );
                fetchData();
            } else {
                toast.error(data.error || "Scheduler failed", { id: "scheduler" });
            }
        } catch (error) {
            toast.error("Failed to run scheduler", { id: "scheduler" });
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "read": return "text-green-600 bg-green-50";
            case "delivered": return "text-blue-600 bg-blue-50";
            case "sent": return "text-yellow-600 bg-yellow-50";
            case "failed": return "text-red-600 bg-red-50";
            default: return "text-gray-600 bg-gray-50";
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case "first": return "📬 First";
            case "reminder": return "⏰ Reminder";
            case "before_visit": return "📅 Before Visit";
            case "missed_visit": return "⚠️ Missed Visit";
            default: return type;
        }
    };

    const filteredRules = rules.filter((rule) => {
        const userName = rule.userId ? `${rule.userId.firstName || ""} ${rule.userId.lastName || ""}`.toLowerCase() : "";
        const agencyName = rule.agencyId?.name?.toLowerCase() || "";
        return userName.includes(searchTerm.toLowerCase()) || agencyName.includes(searchTerm.toLowerCase());
    });

    const getUserName = (user?: IUser) => {
        if (!user) return "Unknown";
        return user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user.username || "Unknown";
    };

    return (
        <div className="min-h-screen bg-white pb-20">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-4xl font-extrabold text-gray-900">
                            Notification Master
                        </h1>
                        <p className="text-gray-600 mt-2 text-sm font-medium">
                            Manage WhatsApp notification rules and view delivery logs
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={triggerScheduler}
                            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95"
                        >
                            <RefreshCw className="w-5 h-5" />
                            Run Scheduler
                        </button>
                        <button
                            onClick={() => handleOpenModal()}
                            className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95"
                        >
                            <Plus className="w-5 h-5" />
                            Add Rule
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab("rules")}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === "rules"
                                ? "bg-gray-900 text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                    >
                        <Bell className="w-4 h-4 inline-block mr-2" />
                        Rules ({rules.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("logs")}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === "logs"
                                ? "bg-gray-900 text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                    >
                        <Activity className="w-4 h-4 inline-block mr-2" />
                        Logs ({logs.length})
                    </button>
                </div>

                {/* Search */}
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-8 shadow-sm">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 w-full bg-white border border-gray-300 rounded-xl py-3 text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-gray-400"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-16">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading...</p>
                    </div>
                ) : activeTab === "rules" ? (
                    /* Rules List */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredRules.length === 0 ? (
                            <div className="col-span-full text-center py-16 bg-gray-50 rounded-2xl">
                                <Bell className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                                <p className="text-gray-600 mb-4">No notification rules found</p>
                                <button
                                    onClick={() => handleOpenModal()}
                                    className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold"
                                >
                                    Create First Rule
                                </button>
                            </div>
                        ) : (
                            filteredRules.map((rule) => (
                                <div
                                    key={rule._id}
                                    className={`bg-white border rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all group ${rule.active ? "border-gray-200" : "border-red-200 bg-red-50/30"
                                        }`}
                                >
                                    <div className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${rule.type === "user" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                                                    }`}>
                                                    {rule.type === "user" ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900">
                                                        {rule.type === "user" ? getUserName(rule.userId) : rule.agencyId?.name}
                                                    </h3>
                                                    <span className={`text-xs px-2 py-0.5 rounded ${rule.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                                        }`}>
                                                        {rule.active ? "Active" : "Inactive"}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleOpenModal(rule)}
                                                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(rule._id)}
                                                    className="p-2 hover:bg-rose-100 rounded-lg text-rose-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2 text-sm">
                                            {rule.type === "user" && (
                                                <>
                                                    <div className="flex items-center gap-2 text-gray-700">
                                                        <Clock className="w-4 h-4 text-gray-500" />
                                                        <span>Reminder after {rule.reminderAfterHours}h</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-gray-700">
                                                        <MessageSquare className="w-4 h-4 text-gray-500" />
                                                        <span>Max {rule.maxReminders} reminders</span>
                                                    </div>
                                                </>
                                            )}
                                            {rule.type === "agency" && (
                                                <div className="flex items-center gap-2 text-gray-700">
                                                    <Calendar className="w-4 h-4 text-gray-500" />
                                                    <span>Notify {rule.notifyBeforeDays} day(s) before</span>
                                                </div>
                                            )}
                                            {rule.subCategoryIds && rule.subCategoryIds.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-gray-200">
                                                    <div className="flex flex-wrap gap-1">
                                                        {rule.subCategoryIds.slice(0, 3).map((sub: any) => (
                                                            <span key={sub._id} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                                                {sub.name}
                                                            </span>
                                                        ))}
                                                        {rule.subCategoryIds.length > 3 && (
                                                            <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded">
                                                                +{rule.subCategoryIds.length - 3} more
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    /* Logs Table */
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ticket</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Recipient</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Replied</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Sent At</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                                                No notification logs yet
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map((log) => (
                                            <tr key={log._id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm">
                                                    {log.ticketId ? (
                                                        <span className="font-mono text-blue-600">#{log.ticketId.ticketId}</span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <div>{log.userId ? getUserName(log.userId) : log.agencyId?.name || "-"}</div>
                                                    <div className="text-xs text-gray-500">{log.recipientPhone}</div>
                                                </td>
                                                <td className="px-4 py-3 text-sm">{getTypeLabel(log.type)}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(log.deliveryStatus)}`}>
                                                        {log.deliveryStatus === "read" && <Eye className="w-3 h-3 inline mr-1" />}
                                                        {log.deliveryStatus === "delivered" && <CheckCircle className="w-3 h-3 inline mr-1" />}
                                                        {log.deliveryStatus === "failed" && <XCircle className="w-3 h-3 inline mr-1" />}
                                                        {log.deliveryStatus}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    {log.replied ? (
                                                        <span className="text-green-600">✓ Yes</span>
                                                    ) : (
                                                        <span className="text-gray-400">No</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {new Date(log.sentAt).toLocaleDateString("en-IN", {
                                                        day: "numeric",
                                                        month: "short",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 max-h-[90vh] flex flex-col">
                            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                <h2 className="text-lg font-bold text-gray-900">
                                    {editingRule ? "Edit Rule" : "Add Notification Rule"}
                                </h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-600 hover:text-gray-900">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4 overflow-y-auto flex-1">
                                {/* Type */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                        Notification Type *
                                    </label>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, type: "user", agencyId: "" })}
                                            className={`flex-1 p-3 rounded-xl border-2 font-medium transition-all ${formData.type === "user"
                                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                                                }`}
                                        >
                                            <User className="w-5 h-5 mx-auto mb-1" />
                                            User
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, type: "agency", userId: "" })}
                                            className={`flex-1 p-3 rounded-xl border-2 font-medium transition-all ${formData.type === "agency"
                                                    ? "border-orange-500 bg-orange-50 text-orange-700"
                                                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                                                }`}
                                        >
                                            <Building2 className="w-5 h-5 mx-auto mb-1" />
                                            Agency
                                        </button>
                                    </div>
                                </div>

                                {/* User/Agency Select */}
                                {formData.type === "user" ? (
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                            Select User *
                                        </label>
                                        <select
                                            value={formData.userId}
                                            onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                                            className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900"
                                        >
                                            <option value="">-- Select User --</option>
                                            {users.filter(u => u.phone).map((user) => (
                                                <option key={user._id} value={user._id}>
                                                    {getUserName(user)} {user.phone ? `(${user.phone})` : "(No phone)"}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                            Select Agency *
                                        </label>
                                        <select
                                            value={formData.agencyId}
                                            onChange={(e) => setFormData({ ...formData, agencyId: e.target.value })}
                                            className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900"
                                        >
                                            <option value="">-- Select Agency --</option>
                                            {agencies.filter(a => a.phone).map((agency) => (
                                                <option key={agency._id} value={agency._id}>
                                                    {agency.name} {agency.phone ? `(${agency.phone})` : "(No phone)"}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Timing Config */}
                                {formData.type === "user" ? (
                                    <>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                                Reminder After (Hours)
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={formData.reminderAfterHours}
                                                onChange={(e) => setFormData({ ...formData, reminderAfterHours: parseInt(e.target.value) || 12 })}
                                                className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                                Max Reminders
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={formData.maxReminders}
                                                onChange={(e) => setFormData({ ...formData, maxReminders: parseInt(e.target.value) || 3 })}
                                                className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                            Notify Before Visit (Days)
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.notifyBeforeDays}
                                            onChange={(e) => setFormData({ ...formData, notifyBeforeDays: parseInt(e.target.value) || 1 })}
                                            className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900"
                                        />
                                    </div>
                                )}

                                {/* Active Toggle */}
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                    <span className="font-medium text-gray-700">Active</span>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, active: !formData.active })}
                                        className={`w-12 h-6 rounded-full transition-colors ${formData.active ? "bg-green-500" : "bg-gray-300"
                                            }`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.active ? "translate-x-6" : "translate-x-0.5"
                                            }`} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl shadow-lg flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    Save Rule
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
