// app/purchase/page.tsx
"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import Navbar from "@/components/Navbar";
import { toast } from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  ShoppingCart,
  Package,
  User as UserIcon,
  CheckCircle2,
  Clock,
  Send,
  X,
  Phone,
  MapPin,
  Tag,
  AlertCircle,
  Search,
  Filter,
  ExternalLink,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface User {
  _id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  phone?: string;
}

interface Ticket {
  _id: string;
  ticketId: string;
  description: string;
  category?: string;
  subCategory?: string;
  priority: string;
  location?: string;
  status: string;
  createdAt: string;
  photos?: string[];
  videos?: string[];
  assignedTo?: User | null;
  assignedAt?: string;
}

// Stat Card Component
function StatCard({
  label,
  value,
  icon,
  color = "blue",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: "blue" | "green" | "orange" | "purple" | "red";
}) {
  const colorStyles = {
    blue: "from-blue-50 to-blue-100 border-blue-200 text-blue-700",
    green: "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700",
    orange: "from-amber-50 to-amber-100 border-amber-200 text-amber-700",
    purple: "from-purple-50 to-purple-100 border-purple-200 text-purple-700",
    red: "from-red-50 to-red-100 border-red-200 text-red-700",
  };

  const iconColors = {
    blue: "bg-blue-500",
    green: "bg-emerald-500",
    orange: "bg-amber-500",
    purple: "bg-purple-500",
    red: "bg-red-500",
  };

  return (
    <div className={`bg-gradient-to-br ${colorStyles[color]} border rounded-2xl p-5 transition-all hover:shadow-lg`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
          <p className={`text-3xl font-bold ${colorStyles[color].split(' ').pop()}`}>{value}</p>
        </div>
        <div className={`${iconColors[color]} w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// Priority Badge
function PriorityBadge({ priority }: { priority: string }) {
  const styles = {
    high: "bg-red-100 text-red-700 border-red-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    low: "bg-emerald-100 text-emerald-700 border-emerald-200",
  }[priority.toLowerCase()] || "bg-gray-100 text-gray-700 border-gray-200";

  const emoji = {
    high: "🔴",
    medium: "🟡",
    low: "🟢",
  }[priority.toLowerCase()] || "⚪";

  return (
    <span className={`${styles} px-2.5 py-1 rounded-full text-xs font-semibold border inline-flex items-center gap-1`}>
      {emoji} {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

// Status Badge
function StatusBadge({ status }: { status: string }) {
  const isPending = status === "PENDING";
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
      isPending 
        ? "bg-amber-100 text-amber-700 border border-amber-200" 
        : "bg-emerald-100 text-emerald-700 border border-emerald-200"
    }`}>
      {isPending ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
      {status}
    </span>
  );
}

export default function PurchasePage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.isSuperAdmin || false;
  
  const [statusFilter, setStatusFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");

  // Build query params
  const queryParams = new URLSearchParams();
  if (statusFilter) queryParams.set("status", statusFilter);
  if (assignedFilter) queryParams.set("assigned", assignedFilter);

  const { data, error, mutate } = useSWR(
    `/api/tickets/purchase?${queryParams}`,
    fetcher
  );

  // Fetch users when modal opens
  useEffect(() => {
    if (assignModalOpen) {
      fetchUsers();
    }
  }, [assignModalOpen]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/masters/users?limit=100");
      const data = await res.json();
      if (data.success) {
        // Filter users with phone numbers
        setUsers(data.data.filter((u: User) => u.phone || u.username));
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Generate WhatsApp message for all tickets
  const generateAllTicketsMessage = (tickets: Ticket[], userName: string): string => {
    const dateStr = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    let message = `🛒 *Purchase Requests Assigned*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `Hello ${userName},\n\n`;
    message += `You have been assigned *${tickets.length}* purchase request${tickets.length > 1 ? 's' : ''}:\n\n`;

    tickets.forEach((ticket, index) => {
      const priorityEmoji = { high: "🔴", medium: "🟡", low: "🟢" }[ticket.priority.toLowerCase()] || "🟡";
      
      message += `*${index + 1}. ${ticket.ticketId}*\n`;
      message += `   📝 ${ticket.description || 'No description'}\n`;
      if (ticket.category) {
        const categoryDisplay = ticket.subCategory
          ? `${ticket.category} → ${ticket.subCategory}`
          : ticket.category;
        message += `   📁 ${categoryDisplay}\n`;
      }
      message += `   ${priorityEmoji} Priority: ${ticket.priority.toUpperCase()}\n`;
      if (ticket.location) {
        message += `   📍 ${ticket.location}\n`;
      }
      // Add photo links
      if (ticket.photos && ticket.photos.length > 0) {
        message += `   📷 Photos:\n`;
        ticket.photos.forEach((photo, photoIndex) => {
          message += `      ${photoIndex + 1}. ${photo}\n`;
        });
      }
      message += `\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📅 *Assigned On:* ${dateStr}\n\n`;
    message += `Please proceed with the purchases and update the status once completed.`;

    return message;
  };

  const handleAssignUser = async (userId: string, user: User) => {
    // Get all unassigned pending tickets
    const unassignedTickets = (data?.data || []).filter(
      (t: Ticket) => !t.assignedTo && t.status === "PENDING"
    );

    if (unassignedTickets.length === 0) {
      toast.error("No unassigned tickets to assign");
      return;
    }

    setAssigning(true);
    try {
      // Assign all tickets to this user
      const assignPromises = unassignedTickets.map((ticket: Ticket) =>
        fetch(`/api/tickets/${ticket.ticketId}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        }).then(res => res.json())
      );

      const results = await Promise.all(assignPromises);
      const successCount = results.filter(r => r.success).length;

      // Close modal first
      setAssignModalOpen(false);
      mutate();

      if (successCount > 0) {
        toast.success(`${successCount} ticket${successCount > 1 ? 's' : ''} assigned! Opening WhatsApp...`);

        // Generate message with all ticket details
        if (user.phone) {
          const cleanPhone = user.phone.replace(/\D/g, '');
          const userName = user.firstName || user.username || 'User';
          const message = generateAllTicketsMessage(unassignedTickets, userName);
          const encodedMessage = encodeURIComponent(message);
          window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, "_blank");
        } else {
          toast.error("⚠️ User doesn't have a phone number. Unable to send WhatsApp message.");
        }
      } else {
        toast.error("Failed to assign tickets");
      }
    } catch (err) {
      console.error("Error assigning user", err);
      toast.error("An error occurred");
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (ticketId: string) => {
    if (!confirm("Are you sure you want to unassign this user?")) return;

    try {
      const res = await fetch(`/api/tickets/${ticketId}/assign`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        toast.success("User unassigned");
        mutate();
      } else {
        toast.error(data.error || "Failed to unassign");
      }
    } catch (err) {
      console.error("Error unassigning", err);
      toast.error("An error occurred");
    }
  };

  // Filter tickets by search term
  const filteredTickets = (data?.data || []).filter((ticket: Ticket) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      ticket.ticketId.toLowerCase().includes(searchLower) ||
      ticket.description?.toLowerCase().includes(searchLower) ||
      ticket.category?.toLowerCase().includes(searchLower) ||
      ticket.location?.toLowerCase().includes(searchLower)
    );
  });

  // Filter users by search term
  const filteredUsers = users.filter((user) => {
    if (!userSearchTerm) return true;
    const searchLower = userSearchTerm.toLowerCase();
    return (
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.lastName?.toLowerCase().includes(searchLower) ||
      user.username?.toLowerCase().includes(searchLower) ||
      user.phone?.includes(userSearchTerm)
    );
  });

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-red-800 mb-2">Failed to load purchase tickets</h2>
            <p className="text-red-600">Please try refreshing the page</p>
          </div>
        </div>
      </div>
    );
  }

  const stats = data?.stats || { total: 0, pending: 0, completed: 0, assigned: 0, unassigned: 0 };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <ShoppingCart className="w-8 h-8 text-purple-600" />
                Purchase Requests
              </h1>
              <p className="text-gray-500">
                Manage tickets marked as "New" that require purchasing items
              </p>
            </div>

            {/* Global Assign User Button - Only for Super Admin */}
            {isSuperAdmin && stats.unassigned > 0 && (
              <button
                onClick={() => setAssignModalOpen(true)}
                className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-600/20"
              >
                <UserIcon className="w-5 h-5" />
                Assign User
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">
                  {stats.unassigned} tickets
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
          <StatCard
            label="Total Requests"
            value={stats.total}
            color="purple"
            icon={<Package className="w-6 h-6" />}
          />
          <StatCard
            label="Pending"
            value={stats.pending}
            color="orange"
            icon={<Clock className="w-6 h-6" />}
          />
          <StatCard
            label="Completed"
            value={stats.completed}
            color="green"
            icon={<CheckCircle2 className="w-6 h-6" />}
          />
          <StatCard
            label="Assigned"
            value={stats.assigned}
            color="blue"
            icon={<UserIcon className="w-6 h-6" />}
          />
          <StatCard
            label="Unassigned"
            value={stats.unassigned}
            color="red"
            icon={<AlertCircle className="w-6 h-6" />}
          />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by ticket ID, description, category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none transition-all"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-700 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Completed</option>
            </select>

            {/* Assignment Filter */}
            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-700 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none"
            >
              <option value="">All Assignment</option>
              <option value="true">Assigned</option>
              <option value="false">Unassigned</option>
            </select>
          </div>
        </div>

        {/* Tickets List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Purchase Tickets</h3>
              <span className="text-sm text-gray-500">
                Showing {filteredTickets.length} tickets
              </span>
            </div>
          </div>

          {!data ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500">Loading purchase tickets...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No purchase tickets found</h3>
              <p className="text-gray-500">
                Tickets marked as "New" during creation will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredTickets.map((ticket: Ticket) => (
                <div key={ticket._id} className="p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Ticket Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-gray-900">{ticket.ticketId}</span>
                        <PriorityBadge priority={ticket.priority} />
                        <StatusBadge status={ticket.status} />
                      </div>
                      <p className="text-gray-700 mb-2 line-clamp-2">{ticket.description}</p>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                        {ticket.category && (
                          <span className="flex items-center gap-1">
                            <Tag className="w-4 h-4" />
                            {ticket.subCategory ? `${ticket.category} → ${ticket.subCategory}` : ticket.category}
                          </span>
                        )}
                        {ticket.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {ticket.location}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Assignment Section - Aligned Right */}
                    <div className="flex items-center gap-3 ml-auto lg:ml-0 lg:flex-shrink-0">
                      {ticket.assignedTo ? (
                        <>
                          {/* Show full user details only for super admin */}
                          {isSuperAdmin ? (
                            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2">
                              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                {(ticket.assignedTo.firstName?.[0] || ticket.assignedTo.username?.[0] || "U").toUpperCase()}
                              </div>
                              <div className="text-sm">
                                <div className="font-semibold text-gray-900">
                                  {ticket.assignedTo.firstName || ticket.assignedTo.username}
                                </div>
                                {ticket.assignedTo.phone && (
                                  <div className="text-gray-500 flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {ticket.assignedTo.phone}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => handleUnassign(ticket.ticketId)}
                                className="ml-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Unassign user"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            /* Non-super-admin sees only 'Assigned' status */
                            <span className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium rounded-lg flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4" />
                              Assigned
                            </span>
                          )}

                          {/* Send to WhatsApp button - only for super admin */}
                          {isSuperAdmin && ticket.assignedTo.phone && (
                            <button
                              onClick={() => {
                                const phone = ticket.assignedTo?.phone?.replace(/\D/g, '');
                                const message = `🛒 *Purchase Request Reminder*\n\nTicket: ${ticket.ticketId}\nDescription: ${ticket.description}\nPriority: ${ticket.priority.toUpperCase()}\n\nPlease update the status once completed.`;
                                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
                              }}
                              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-all shadow-sm"
                              title="Send WhatsApp reminder"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium rounded-lg">
                          Unassigned
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Assign User Modal - Only for Super Admin */}
      {isSuperAdmin && assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Assign User</h2>
                    <p className="text-xs text-gray-500">
                      {stats.unassigned} unassigned purchase ticket{stats.unassigned !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setAssignModalOpen(false);
                    setUserSearchTerm("");
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users by name, username, or phone..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none"
                />
              </div>
            </div>

            {/* Users List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingUsers ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-gray-500 text-sm">Loading users...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8">
                  <UserIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No users found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map((user) => (
                    <button
                      key={user._id}
                      onClick={() => handleAssignUser(user._id, user)}
                      disabled={assigning}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-purple-50 border border-transparent hover:border-purple-200 transition-all text-left disabled:opacity-50"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {(user.firstName?.[0] || user.username?.[0] || "U").toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {user.firstName || user.lastName
                            ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                            : user.username || "Unknown"}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          {user.username && <span>@{user.username}</span>}
                          {user.phone && (
                            <span className="flex items-center gap-1 text-green-600">
                              <Phone className="w-3 h-3" />
                              {user.phone}
                            </span>
                          )}
                        </div>
                      </div>
                      {!user.phone && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                          No phone
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""} available
                </span>
                <button
                  onClick={() => {
                    setAssignModalOpen(false);
                    setUserSearchTerm("");
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
