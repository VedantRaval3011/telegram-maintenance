"use client";
import React, { useState, useMemo, useRef } from "react";
import useSWR from "swr";
import Navbar from "@/components/Navbar";
import { FileText, User, Calendar, Filter, Download, Search, Monitor, MessageSquare, Clock, Tag, MapPin, AlertCircle, ArrowUp } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Helper function to determine if user is from Telegram or Dashboard
const getUserType = (username: string): "telegram" | "dashboard" | "system" => {
  if (!username || username === "Unknown") return "system";
  if (username.toLowerCase() === "system") return "system";
  // Dashboard users typically have structured usernames (admin, user1, etc.)
  // Telegram users often have display names with spaces or special characters
  if (username.includes(" ") || username.match(/[^\w\s]/)) return "telegram";
  return "dashboard";
};

export default function AuditLogsPage() {
  const [filters, setFilters] = useState({
    status: "",
    user: "",
    category: "",
    dateFrom: "",
    dateTo: "",
    action: "", // CREATED, COMPLETED, ASSIGNED
    userType: "", // telegram, dashboard, system
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Refs for scrolling
  const statsRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Build query string
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.user) params.set("user", filters.user);
    if (filters.category) params.set("category", filters.category);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    params.set("limit", "500");
    return params.toString();
  }, [filters]);

  const { data, error, isLoading } = useSWR(
    `/api/audit-logs?${queryString}`,
    fetcher,
    { refreshInterval: 10000 }
  );

  const auditLogs = data?.data || [];

  // Client-side filtering for action, userType, and search
  const filteredLogs = useMemo(() => {
    let logs = auditLogs;

    // Filter by action
    if (filters.action) {
      logs = logs.filter((log: any) => log.action === filters.action);
    }

    // Filter by user type
    if (filters.userType) {
      logs = logs.filter((log: any) => getUserType(log.user) === filters.userType);
    }

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      logs = logs.filter((log: any) => {
        return (
          log.ticketId?.toLowerCase().includes(search) ||
          log.user?.toLowerCase().includes(search) ||
          log.details?.category?.toLowerCase().includes(search) ||
          log.details?.description?.toLowerCase().includes(search)
        );
      });
    }

    return logs;
  }, [auditLogs, filters.action, filters.userType, searchTerm]);

  const resetFilters = () => {
    setFilters({
      status: "",
      user: "",
      category: "",
      dateFrom: "",
      dateTo: "",
      action: "",
      userType: "",
    });
    setSearchTerm("");
  };

  // Scroll to table function
  const scrollToTable = () => {
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Scroll to stats function
  const scrollToStats = () => {
    statsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Handle scroll to show/hide scroll-to-top button
  React.useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const exportToCSV = () => {
    const headers = ["Timestamp", "Ticket ID", "Action", "User", "User Type", "Category", "Priority", "Location", "Details"];
    const rows = filteredLogs.map((log: any) => [
      new Date(log.timestamp).toLocaleString(),
      log.ticketId,
      log.action,
      log.user,
      getUserType(log.user),
      log.details?.category || "",
      log.details?.priority || "",
      log.details?.location || "",
      log.details?.description || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row: any[]) => row.map((cell: any) => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "CREATED":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "COMPLETED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "ASSIGNED":
        return "bg-purple-50 text-purple-700 border-purple-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "CREATED":
        return "➕";
      case "COMPLETED":
        return "✅";
      case "ASSIGNED":
        return "👤";
      default:
        return "📝";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "text-red-600 font-semibold";
      case "medium":
        return "text-amber-600 font-semibold";
      case "low":
        return "text-emerald-600 font-semibold";
      default:
        return "text-gray-600";
    }
  };

  const getUserTypeInfo = (username: string) => {
    const type = getUserType(username);
    switch (type) {
      case "telegram":
        return {
          label: "Telegram",
          icon: <MessageSquare className="w-3.5 h-3.5" />,
          bgColor: "bg-blue-100",
          textColor: "text-blue-700",
          borderColor: "border-blue-300",
        };
      case "dashboard":
        return {
          label: "Dashboard",
          icon: <Monitor className="w-3.5 h-3.5" />,
          bgColor: "bg-purple-100",
          textColor: "text-purple-700",
          borderColor: "border-purple-300",
        };
      case "system":
        return {
          label: "System",
          icon: <AlertCircle className="w-3.5 h-3.5" />,
          bgColor: "bg-gray-100",
          textColor: "text-gray-700",
          borderColor: "border-gray-300",
        };
    }
  };

  // Calculate stats by user type
  const statsByUserType = useMemo(() => {
    const telegram = filteredLogs.filter((l: any) => getUserType(l.user) === "telegram").length;
    const dashboard = filteredLogs.filter((l: any) => getUserType(l.user) === "dashboard").length;
    const system = filteredLogs.filter((l: any) => getUserType(l.user) === "system").length;
    return { telegram, dashboard, system };
  }, [filteredLogs]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            Failed to load audit logs. Please try again.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-20">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-xl">
                  <FileText className="w-7 h-7 text-white" />
                </div>
                Audit Logs
              </h1>
              <p className="text-gray-600 mt-2 ml-1">
                Track all ticket activities and user actions across the system
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm ${
                  showFilters
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                <Filter className="w-4 h-4" />
                {showFilters ? "Hide" : "Show"} Filters
              </button>
              <button
                onClick={exportToCSV}
                disabled={filteredLogs.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Stats */}
          <div ref={statsRef} className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
            <button
              onClick={() => {
                setFilters({ ...filters, action: "", userType: "" });
                setSearchTerm("");
                scrollToTable();
              }}
              className={`bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-all text-left ${
                !filters.action && !filters.userType && !searchTerm ? "ring-2 ring-gray-400" : ""
              }`}
            >
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Logs</div>
              <div className="text-3xl font-bold text-gray-900">{filteredLogs.length}</div>
            </button>
            <button
              onClick={() => {
                setFilters({ ...filters, action: filters.action === "CREATED" ? "" : "CREATED", userType: "" });
                scrollToTable();
              }}
              className={`bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200 shadow-sm hover:shadow-md transition-all text-left ${
                filters.action === "CREATED" ? "ring-2 ring-blue-500" : ""
              }`}
            >
              <div className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">Created</div>
              <div className="text-3xl font-bold text-blue-900">
                {filteredLogs.filter((l: any) => l.action === "CREATED").length}
              </div>
            </button>
            <button
              onClick={() => {
                setFilters({ ...filters, action: filters.action === "COMPLETED" ? "" : "COMPLETED", userType: "" });
                scrollToTable();
              }}
              className={`bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-5 border border-emerald-200 shadow-sm hover:shadow-md transition-all text-left ${
                filters.action === "COMPLETED" ? "ring-2 ring-emerald-500" : ""
              }`}
            >
              <div className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-1">Completed</div>
              <div className="text-3xl font-bold text-emerald-900">
                {filteredLogs.filter((l: any) => l.action === "COMPLETED").length}
              </div>
            </button>
            <button
              onClick={() => {
                setFilters({ ...filters, action: filters.action === "ASSIGNED" ? "" : "ASSIGNED", userType: "" });
                scrollToTable();
              }}
              className={`bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200 shadow-sm hover:shadow-md transition-all text-left ${
                filters.action === "ASSIGNED" ? "ring-2 ring-purple-500" : ""
              }`}
            >
              <div className="text-xs font-medium text-purple-600 uppercase tracking-wide mb-1">Assigned</div>
              <div className="text-3xl font-bold text-purple-900">
                {filteredLogs.filter((l: any) => l.action === "ASSIGNED").length}
              </div>
            </button>
            <button
              onClick={() => {
                setFilters({ ...filters, userType: filters.userType === "telegram" ? "" : "telegram", action: "" });
                scrollToTable();
              }}
              className={`bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200 shadow-sm hover:shadow-md transition-all text-left ${
                filters.userType === "telegram" ? "ring-2 ring-blue-500" : ""
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                <div className="text-xs font-medium text-blue-600 uppercase tracking-wide">Telegram</div>
              </div>
              <div className="text-3xl font-bold text-blue-900">{statsByUserType.telegram}</div>
            </button>
            <button
              onClick={() => {
                setFilters({ ...filters, userType: filters.userType === "dashboard" ? "" : "dashboard", action: "" });
                scrollToTable();
              }}
              className={`bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200 shadow-sm hover:shadow-md transition-all text-left ${
                filters.userType === "dashboard" ? "ring-2 ring-purple-500" : ""
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Monitor className="w-3.5 h-3.5 text-purple-600" />
                <div className="text-xs font-medium text-purple-600 uppercase tracking-wide">Dashboard</div>
              </div>
              <div className="text-3xl font-bold text-purple-900">{statsByUserType.dashboard}</div>
            </button>
            <button
              onClick={() => {
                setFilters({ ...filters, userType: filters.userType === "system" ? "" : "system", action: "" });
                scrollToTable();
              }}
              className={`bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-all text-left ${
                filters.userType === "system" ? "ring-2 ring-gray-500" : ""
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <AlertCircle className="w-3.5 h-3.5 text-gray-600" />
                <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">System</div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{statsByUserType.system}</div>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ticket ID, user, category, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-sm"
            />
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Advanced Filters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Action
                  </label>
                  <select
                    value={filters.action}
                    onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">All Actions</option>
                    <option value="CREATED">Created</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="ASSIGNED">Assigned</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    User Type
                  </label>
                  <select
                    value={filters.userType}
                    onChange={(e) => setFilters({ ...filters, userType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">All User Types</option>
                    <option value="telegram">Telegram Users</option>
                    <option value="dashboard">Dashboard Users</option>
                    <option value="system">System</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    User
                  </label>
                  <input
                    type="text"
                    placeholder="Filter by user..."
                    value={filters.user}
                    onChange={(e) => setFilters({ ...filters, user: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="Filter by category..."
                    value={filters.category}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Date From
                  </label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Date To
                  </label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={resetFilters}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>

        {/* Audit Logs Table */}
        <div ref={tableRef} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm">Loading audit logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-700 mb-1">No audit logs found</p>
              <p className="text-sm text-gray-500">Try adjusting your filters or search criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Timestamp
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        Ticket ID
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        User
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredLogs.map((log: any, index: number) => {
                    const userTypeInfo = getUserTypeInfo(log.user);
                    return (
                      <tr 
                        key={log.id} 
                        className={`hover:bg-gray-50 transition-colors ${
                          index % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2 text-gray-700">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="font-medium">{new Date(log.timestamp).toLocaleDateString()}</div>
                              <div className="text-xs text-gray-500">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono text-sm font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                            {log.ticketId}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${getActionColor(log.action)}`}>
                            <span>{getActionIcon(log.action)}</span>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 text-sm">{log.user}</span>
                            </div>
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border w-fit ${userTypeInfo.bgColor} ${userTypeInfo.textColor} ${userTypeInfo.borderColor}`}>
                              {userTypeInfo.icon}
                              {userTypeInfo.label}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          <div className="space-y-2">
                            {log.details?.category && (
                              <div className="flex items-start gap-2">
                                <Tag className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <span className="font-medium text-gray-900">{log.details.category}</span>
                                  {log.details.subCategory && (
                                    <span className="text-gray-500"> → {log.details.subCategory}</span>
                                  )}
                                </div>
                              </div>
                            )}
                            {log.details?.priority && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Priority:</span>
                                <span className={`text-xs font-semibold ${getPriorityColor(log.details.priority)}`}>
                                  {log.details.priority.toUpperCase()}
                                </span>
                              </div>
                            )}
                            {log.details?.location && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span className="text-xs text-gray-600">{log.details.location}</span>
                              </div>
                            )}
                            {log.details?.agencyName && (
                              <div className="text-xs text-gray-600">
                                <span className="font-medium">Agency:</span> {log.details.agencyName}
                              </div>
                            )}
                            {log.details?.description && (
                              <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded border border-gray-200 line-clamp-2">
                                {log.details.description}
                              </div>
                            )}
                            {(log.details?.completionPhotos > 0 || log.details?.completionVideos > 0) && (
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                📎 {log.details.completionPhotos || 0} photos, {log.details.completionVideos || 0} videos
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-sm text-gray-500 text-center bg-white rounded-lg py-3 border border-gray-200">
          Showing <span className="font-semibold text-gray-700">{filteredLogs.length}</span> of{" "}
          <span className="font-semibold text-gray-700">{auditLogs.length}</span> total audit logs
        </div>
      </div>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToStats}
          className="fixed bottom-8 right-8 p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-110 z-50"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

