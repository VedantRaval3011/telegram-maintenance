"use client";
import React, { useMemo, useState, useEffect } from "react";
import useSWR from "swr";
import Navbar from "@/components/Navbar";
import TicketCard from "@/components/TicketCard";
import { useAuth } from "@/contexts/AuthContext";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from "recharts";
import { 
  Trophy, TrendingUp, Users, HardHat, Layers, Clock, 
  Zap, Target, CheckCircle2, FileBarChart, UserCheck, Briefcase,
  ChevronDown, ChevronRight, ExternalLink, Info, Search,
  Camera, Video, FileText, Trash2, Download, Plus, Loader2, X, Activity, BarChart3
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

export default function PerformanceAnalyticsPage() {
  const { isReadOnly, hideTimeDetails } = useAuth();
  const { data: ticketsData, isLoading: ticketsLoading, mutate } = useSWR("/api/tickets", fetcher);
  const { data: categoriesData } = useSWR("/api/masters/categories?limit=100", fetcher);
  const { data: subCategoriesData } = useSWR("/api/masters/subcategories?limit=100", fetcher);
  const { data: agenciesData } = useSWR("/api/masters/agencies?limit=100", fetcher);
  const { data: locationsData } = useSWR("/api/masters/locations?limit=500", fetcher);

  // State for expanded rows
  const [expandedUsers, setExpandedUsers] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string | null>(null);
  const [expandedAgencies, setExpandedAgencies] = useState<string | null>(null);
  
  // State for ticket filtering per expanded user/category
  const [ticketFilter, setTicketFilter] = useState<'all' | 'completed' | 'pending'>('all');

  // State for ticket modal
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editFormData, setEditFormData] = useState({
    category: '',
    subCategory: '',
    location: '',
    agencyName: '',
    agencyDate: '',
    agencyTime: '',
    priority: '',
    status: '',
    description: '',
    photos: [] as string[],
    videos: [] as string[],
    documents: [] as string[],
  });

  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [initialAgencyName, setInitialAgencyName] = useState<string>('');

  const tickets = useMemo(() => ticketsData?.data || [], [ticketsData]);
  const categories = useMemo(() => categoriesData?.data || [], [categoriesData]);
  const subCategories = useMemo(() => subCategoriesData?.data || [], [subCategoriesData]);
  const agencies = useMemo(() => agenciesData?.data || [], [agenciesData]);

  // Sync edit form data when selected ticket changes or list updates
  useEffect(() => {
    if (!selectedTicketId || !tickets || tickets.length === 0) return;
    
    const ticket = tickets.find((t: any) => t.ticketId === selectedTicketId);
    if (ticket) {
      setEditFormData({
        category: ticket.category || '',
        subCategory: ticket.subCategory || '',
        location: ticket.location || '',
        agencyName: ticket.agencyName || '',
        agencyDate: ticket.agencyDate ? new Date(ticket.agencyDate).toISOString().split('T')[0] : '',
        agencyTime: ticket.agencyTime || '',
        priority: (ticket.priority || 'medium').toLowerCase(),
        status: ticket.status || 'PENDING',
        description: ticket.description || '',
        photos: ticket.photos || [],
        videos: ticket.videos || [],
        documents: ticket.documents || [],
      });
      setInitialAgencyName(ticket.agencyName || '');
    }
  }, [selectedTicketId, tickets]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photos' | 'videos' | 'documents') => {
    if (!selectedTicketId) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    setUploadProgress(`Uploading ${files.length} file(s)...`);

    try {
      const formData = new FormData();
      formData.append("ticketId", selectedTicketId);
      formData.append("mediaField", type);
      formData.append("uploadedBy", "Analytics Admin");
      Array.from(files).forEach(file => {
        formData.append("files", file);
      });

      const response = await fetch("/api/tickets/upload-media", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();
      setEditFormData(prev => ({
        ...prev,
        [type]: [...(prev[type as keyof typeof editFormData] as string[]), ...result.data.urls]
      }));

      await mutate();
      setUploadProgress("Upload complete!");
      setTimeout(() => setUploadProgress(null), 3000);
    } catch (err: any) {
      console.error(err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploadingFiles(false);
    }
  };

  const removeAttachment = (url: string, type: 'photos' | 'videos' | 'documents') => {
    setEditFormData(prev => ({
      ...prev,
      [type]: (prev[type as keyof typeof editFormData] as string[]).filter(u => u !== url)
    }));
  };

  const hierarchicalLocations = useMemo(() => {
    const raw = locationsData?.data || [];
    if (!raw.length) return [];

    const map = new Map<string, any[]>();
    raw.forEach((loc: any) => {
      const parentVal = loc.parentLocationId?._id || loc.parentLocationId;
      const parentId = parentVal ? parentVal.toString() : "root";
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId)!.push(loc);
    });

    const result: { name: string; fullPath: string; depth: number }[] = [];
    const traverse = (parentId: string, currentPath: string[], depth: number) => {
      const children = map.get(parentId) || [];
      children.sort((a, b) => a.name.localeCompare(b.name));
      children.forEach((child) => {
        const newPath = [...currentPath, child.name];
        result.push({
          name: child.name,
          fullPath: newPath.join(" → "),
          depth
        });
        traverse((child._id?.$oid || child._id || "").toString(), newPath, depth + 1);
      });
    };
    traverse("root", [], 0);
    return result;
  }, [locationsData]);

  const stats = useMemo(() => {
    if (!ticketsData?.data) return null;
    const tickets = ticketsData.data;

    const getActiveDuration = (ticket: any) => {
      if (!ticket.createdAt || !ticket.completedAt) return 0;
      const start = new Date(ticket.createdAt).getTime();
      const end = new Date(ticket.completedAt).getTime();
      
      let inactiveMs = 0;
      if (ticket.reopenedHistory && ticket.reopenedHistory.length > 0) {
        ticket.reopenedHistory.forEach((h: any) => {
          if (h.reopenedAt && h.previousCompletedAt) {
            const s = new Date(h.previousCompletedAt).getTime();
            const e = new Date(h.reopenedAt).getTime();
            if (e > s) inactiveMs += (e - s);
          }
        });
      }
      return Math.max(0, end - start - inactiveMs);
    };

    // 1. User-wise statistics
    const userMap = new Map();
    tickets.forEach((t: any) => {
      const creator = t.createdBy || "Unknown";
      if (!userMap.has(creator)) userMap.set(creator, { name: creator, created: 0, completed: 0, totalDuration: 0, tickets: [] });
      const creatorEntry = userMap.get(creator);
      creatorEntry.created += 1;
      creatorEntry.tickets.push(t);

      if (t.status === "COMPLETED" && t.completedBy) {
        const closer = t.completedBy;
        if (!userMap.has(closer)) userMap.set(closer, { name: closer, created: 0, completed: 0, totalDuration: 0, tickets: [] });
        const entry = userMap.get(closer);
        entry.completed += 1;
        if (creator !== closer) {
          entry.tickets.push(t);
        }
        
        if (t.completedAt && t.createdAt) {
          entry.totalDuration += getActiveDuration(t);
        }
      }
    });

    // 2. Agency-wise analysis
    const agencyMap = new Map();
    tickets.forEach((t: any) => {
      const agency = t.agencyName || "Unassigned";
      if (agency === "NONE" || agency === "__NONE__" || agency === "null") return;

      if (!agencyMap.has(agency)) agencyMap.set(agency, { name: agency, assigned: 0, completed: 0, totalDuration: 0, tickets: [] });
      const entry = agencyMap.get(agency);
      entry.assigned += 1;
      entry.tickets.push(t);

      if (t.status === "COMPLETED" && t.completedAt && t.createdAt) {
        entry.completed += 1;
        entry.totalDuration += getActiveDuration(t);
      }
    });

    // 3. Category-wise analysis
    const categoryMap = new Map();
    tickets.forEach((t: any) => {
      const cat = t.category || "Uncategorized";
      if (!categoryMap.has(cat)) categoryMap.set(cat, { name: cat, created: 0, completed: 0, totalDuration: 0, tickets: [] });
      const entry = categoryMap.get(cat);
      entry.created += 1;
      entry.tickets.push(t);

      if (t.status === "COMPLETED" && t.completedAt && t.createdAt) {
        entry.completed += 1;
        entry.totalDuration += getActiveDuration(t);
      }
    });

    const userStats = Array.from(userMap.values()).map(u => ({
      ...u,
      pending: u.created - u.completed,
      avgDurationHours: u.completed > 0 ? Number((u.totalDuration / u.completed / (1000 * 60 * 60)).toFixed(1)) : 0
    })).sort((a, b) => b.created - a.created);

    const agencyStats = Array.from(agencyMap.values())
      .map(a => ({
        ...a,
        pending: a.assigned - a.completed,
        avgDurationHours: a.completed > 0 ? Number((a.totalDuration / a.completed / (1000 * 60 * 60)).toFixed(1)) : 0
      }))
      .sort((a, b) => a.avgDurationHours - b.avgDurationHours || b.assigned - a.assigned);

    const categoryStats = Array.from(categoryMap.values())
      .map(c => ({
        ...c,
        pending: c.created - c.completed,
        avgDurationHours: c.completed > 0 ? Number((c.totalDuration / c.completed / (1000 * 60 * 60)).toFixed(1)) : 0,
        completionRate: Number(((c.completed / c.created) * 100).toFixed(0))
      }))
      .sort((a, b) => b.created - a.created);

    return { userStats, agencyStats, categoryStats };
  }, [ticketsData]);

  if (ticketsLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-500 font-medium">Generating performance report...</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const TicketList = ({ tickets, color }: { tickets: any[], color: string }) => (
    <div className="px-6 py-4 bg-gray-50/80 border-t border-gray-100">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tickets.map((t, i) => (
          <div key={i} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300 transition-all flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black tracking-widest text-gray-400 uppercase">#{t.ticketId}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                t.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {t.status}
              </span>
            </div>
            {/* Category Badge */}
            {t.category && (
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Category:</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                  {t.category}
                </span>
              </div>
            )}
            <p className="text-xs font-medium text-gray-700 line-clamp-2 min-h-[32px]">{t.description}</p>
            <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
              <span className="text-[10px] text-gray-400 font-medium">
                {new Date(t.createdAt).toLocaleDateString()}
              </span>
              <button 
                onClick={() => setSelectedTicketId(t.ticketId)}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                title="View full ticket details"
              >
                VIEW TICKET <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 pb-12 pt-8">
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">Performance & Analytics</h1>
              <p className="text-gray-500 font-medium">Click on rows to view connected tickets.</p>
            </div>
          </div>
        </div>

        {/* Top Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Zap className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Fastest Agency</span>
            </div>
            <div className="text-2xl font-black text-gray-900 mb-1">
              {stats.agencyStats.filter(a => a.completed > 0)[0]?.name || "N/A"}
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-sm">
              <Clock className="w-4 h-4" />
              {stats.agencyStats.filter(a => a.completed > 0)[0]?.avgDurationHours || 0}h avg. resolution
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-indigo-100 shadow-sm relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Trophy className="w-5 h-5 text-indigo-600" />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Top User</span>
            </div>
            <div className="text-2xl font-black text-gray-900 mb-1">
              {stats.userStats.sort((a,b) => b.completed - a.completed)[0]?.name || "N/A"}
            </div>
            <div className="flex items-center gap-1.5 text-indigo-600 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              {stats.userStats.sort((a,b) => b.completed - a.completed)[0]?.completed || 0} tickets resolved
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Layers className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Busiest Category</span>
            </div>
            <div className="text-2xl font-black text-gray-900 mb-1">
              {stats.categoryStats[0]?.name || "N/A"}
            </div>
            <div className="flex items-center gap-1.5 text-amber-600 font-bold text-sm">
              <Target className="w-4 h-4" />
              {stats.categoryStats[0]?.created || 0} total requests
            </div>
          </div>
        </div>

        {/* Detailed Stats Tables */}
        <div className="space-y-8">
          {/* User Stats Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-indigo-50/30">
              <div className="flex items-center gap-3">
                <UserCheck className="w-6 h-6 text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-900">User Performance Matrix</h2>
              </div>
              <span className="text-xs font-medium text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full uppercase tracking-wider">
                {stats.userStats.length} Users Tracked
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest w-10"></th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">User Name</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Tickets Created</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Completed</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Pending</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Avg. Time Taken</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.userStats.map((u, idx) => (
                    <React.Fragment key={idx}>
                      <tr 
                        className={`hover:bg-indigo-50/30 cursor-pointer transition-colors ${expandedUsers === u.name ? 'bg-indigo-50/50' : ''}`}
                        onClick={() => {
                          if (expandedUsers === u.name) {
                            setExpandedUsers(null);
                          } else {
                            setExpandedUsers(u.name);
                            setTicketFilter('all'); // Reset filter to 'all' when expanding
                          }
                        }}
                      >
                        <td className="px-6 py-4">
                          {expandedUsers === u.name ? <ChevronDown className="w-4 h-4 text-indigo-600" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                              {u.name.charAt(0)}
                            </div>
                            <span className="text-sm font-bold text-gray-800">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold border border-blue-100">
                            {u.created}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-bold border border-emerald-100">
                            {u.completed}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-sm font-bold border border-amber-100">
                            {u.pending}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-medium text-gray-600 flex items-center justify-end gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {u.avgDurationHours}h
                          </span>
                        </td>
                      </tr>
                      {expandedUsers === u.name && (
                        <tr>
                          <td colSpan={6} className="bg-gray-50/50 p-0">
                            {/* Filter Buttons */}
                            <div className="px-6 py-4 border-b border-gray-200 bg-white/50 flex items-center gap-3">
                              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filter:</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTicketFilter('all');
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                                    ticketFilter === 'all'
                                      ? 'bg-blue-600 text-white shadow-md'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  All ({u.created})
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTicketFilter('completed');
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                                    ticketFilter === 'completed'
                                      ? 'bg-emerald-600 text-white shadow-md'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  Completed ({u.completed})
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTicketFilter('pending');
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                                    ticketFilter === 'pending'
                                      ? 'bg-amber-600 text-white shadow-md'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  Pending ({u.pending})
                                </button>
                              </div>
                            </div>
                            {/* Filtered Ticket List */}
                            <TicketList 
                              tickets={
                                ticketFilter === 'completed' 
                                  ? u.tickets.filter((t: any) => t.status === 'COMPLETED')
                                  : ticketFilter === 'pending'
                                  ? u.tickets.filter((t: any) => t.status !== 'COMPLETED')
                                  : u.tickets
                              } 
                              color="#6366f1" 
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category Stats Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-amber-50/30">
              <div className="flex items-center gap-3">
                <FileBarChart className="w-6 h-6 text-amber-600" />
                <h2 className="text-lg font-bold text-gray-900">Category Efficiency Analysis</h2>
              </div>
              <span className="text-xs font-medium text-amber-600 bg-amber-100 px-3 py-1 rounded-full uppercase tracking-wider">
                {stats.categoryStats.length} Categories
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest w-10"></th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Category</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Total Requests</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Completed</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Avg. Resolution Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.categoryStats.map((c, idx) => (
                    <React.Fragment key={idx}>
                      <tr 
                        className={`hover:bg-amber-50/30 cursor-pointer transition-colors ${expandedCategories === c.name ? 'bg-amber-50/50' : ''}`}
                        onClick={() => {
                          if (expandedCategories === c.name) {
                            setExpandedCategories(null);
                          } else {
                            setExpandedCategories(c.name);
                            setTicketFilter('all'); // Reset filter to 'all' when expanding
                          }
                        }}
                      >
                        <td className="px-6 py-4">
                          {expandedCategories === c.name ? <ChevronDown className="w-4 h-4 text-amber-600" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[idx % COLORS.length]}}></div>
                            <span className="text-sm font-bold text-gray-800">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="font-bold text-gray-700">{c.created}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-bold text-emerald-600">{c.completed}</span>
                            <div className="w-24 h-1 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500" style={{width: `${c.completionRate}%`}}></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-bold text-indigo-600">{c.avgDurationHours}h</span>
                        </td>
                      </tr>
                      {expandedCategories === c.name && (
                        <tr>
                          <td colSpan={5} className="bg-gray-50/50 p-0">
                            {/* Filter Buttons */}
                            <div className="px-6 py-4 border-b border-gray-200 bg-white/50 flex items-center gap-3">
                              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filter:</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTicketFilter('all');
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                                    ticketFilter === 'all'
                                      ? 'bg-blue-600 text-white shadow-md'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  All ({c.created})
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTicketFilter('completed');
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                                    ticketFilter === 'completed'
                                      ? 'bg-emerald-600 text-white shadow-md'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  Completed ({c.completed})
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTicketFilter('pending');
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                                    ticketFilter === 'pending'
                                      ? 'bg-amber-600 text-white shadow-md'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  Pending ({c.pending})
                                </button>
                              </div>
                            </div>
                            {/* Filtered Ticket List */}
                            <TicketList 
                              tickets={
                                ticketFilter === 'completed' 
                                  ? c.tickets.filter((t: any) => t.status === 'COMPLETED')
                                  : ticketFilter === 'pending'
                                  ? c.tickets.filter((t: any) => t.status !== 'COMPLETED')
                                  : c.tickets
                              } 
                              color="#f59e0b" 
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Agency Stats Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-emerald-50/30">
              <div className="flex items-center gap-3">
                <Briefcase className="w-6 h-6 text-emerald-600" />
                <h2 className="text-lg font-bold text-gray-900">Agency SLA Performance</h2>
              </div>
              <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">
                {stats.agencyStats.length} Agencies
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest w-10"></th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Agency Name</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Assigned Tickets</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Completed</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Avg. Resolution Speed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.agencyStats.map((a, idx) => (
                    <React.Fragment key={idx}>
                      <tr 
                        className={`hover:bg-emerald-50/30 cursor-pointer transition-colors ${expandedAgencies === a.name ? 'bg-emerald-50/50' : ''}`}
                        onClick={() => {
                          if (expandedAgencies === a.name) {
                            setExpandedAgencies(null);
                          } else {
                            setExpandedAgencies(a.name);
                            setTicketFilter('all'); // Reset filter to 'all' when expanding
                          }
                        }}
                      >
                        <td className="px-6 py-4">
                          {expandedAgencies === a.name ? <ChevronDown className="w-4 h-4 text-emerald-600" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-gray-800">{a.name}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-bold text-gray-700">{a.assigned}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-bold text-emerald-600">{a.completed}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                              a.avgDurationHours < 24 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                              {a.avgDurationHours}h
                            </span>
                          </div>
                        </td>
                      </tr>
                      {expandedAgencies === a.name && (
                        <tr>
                          <td colSpan={5} className="bg-gray-50/50 p-0">
                            {/* Filter Buttons */}
                            <div className="px-6 py-4 border-b border-gray-200 bg-white/50 flex items-center gap-3">
                              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filter:</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTicketFilter('all');
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                                    ticketFilter === 'all'
                                      ? 'bg-blue-600 text-white shadow-md'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  All ({a.assigned})
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTicketFilter('completed');
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                                    ticketFilter === 'completed'
                                      ? 'bg-emerald-600 text-white shadow-md'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  Completed ({a.completed})
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTicketFilter('pending');
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                                    ticketFilter === 'pending'
                                      ? 'bg-amber-600 text-white shadow-md'
                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`}
                                >
                                  Pending ({a.pending})
                                </button>
                              </div>
                            </div>
                            {/* Filtered Ticket List */}
                            <TicketList 
                              tickets={
                                ticketFilter === 'completed' 
                                  ? a.tickets.filter((t: any) => t.status === 'COMPLETED')
                                  : ticketFilter === 'pending'
                                  ? a.tickets.filter((t: any) => t.status !== 'COMPLETED')
                                  : a.tickets
                              } 
                              color="#10b981" 
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-12">
          {/* User performance Chart */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <Users className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-gray-900">Workload Distribution</h2>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.userStats.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 11, fontWeight: 500}} 
                    dy={10}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                  <Bar dataKey="created" name="Requests Created" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="completed" name="Requests Completed" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Agency Resolution Time */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <HardHat className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-gray-900">Resolution Trends (Agencies)</h2>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.agencyStats.filter(a => a.completed > 0)}>
                  <defs>
                    <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#64748b', fontSize: 11, fontWeight: 500}} 
                    dy={10}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Area type="monotone" dataKey="avgDurationHours" name="Avg Speed (Hrs)" stroke="#10b981" fillOpacity={1} fill="url(#colorAvg)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>

      {/* Ticket Details Modal */}
      {selectedTicketId && (() => {
        const selectedTicket = tickets.find((t: any) => t.ticketId === selectedTicketId);
        if (!selectedTicket) return null;

        const selectedCategoryData = categories.find((c: any) => c.name === editFormData.category);
        const availableSubcategories = selectedCategoryData 
          ? subCategories
              .filter((sub: any) => sub.categoryId === selectedCategoryData._id)
              .map((sub: any) => sub.name)
          : [];

        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all" 
            onClick={() => {
              setSelectedTicketId(null);
              setIsEditMode(false);
            }}
          >
            <div className="absolute inset-0" />
            
            {!isEditMode ? (
              <div
                className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <TicketCard
                  ticket={selectedTicket}
                  onStatusChange={() => mutate()}
                  categoryColor={
                    categories.find((c: any) => c.name.toLowerCase() === (selectedTicket.category || "").toLowerCase())?.color
                  }
                  onEditClick={() => setIsEditMode(true)}
                  isReadOnly={isReadOnly}
                  hideTimeDetails={hideTimeDetails}
                />
              </div>
            ) : (
              <div
                className="relative w-full max-w-4xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-3xl shadow-2xl animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-100 px-8 py-6 rounded-t-3xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 rounded-xl shadow-lg">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-gray-900">Edit Ticket</h2>
                      <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">#{selectedTicket.ticketId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsEditMode(false)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all flex items-center gap-2"
                    >
                      <ChevronRight className="w-4 h-4 rotate-180" /> Back
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTicketId(null);
                        setIsEditMode(false);
                      }}
                      className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="p-8 space-y-8">
                  {/* Description */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Description</label>
                    <textarea
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-indigo-500 rounded-xl transition-all resize-none min-h-[120px] font-medium"
                      placeholder="Enter ticket description..."
                    />
                  </div>

                  {/* Core Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-2 mb-4">
                        <Info className="w-4 h-4 text-indigo-600" />
                        <h3 className="text-sm font-black text-gray-900 uppercase">Classifications</h3>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Category</label>
                          <select
                            value={editFormData.category}
                            onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value, subCategory: '' })}
                            className="w-full px-4 py-2.5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 rounded-xl transition-all font-bold"
                          >
                            <option value="">Select Category</option>
                            {categories.map((cat: any) => (<option key={cat._id} value={cat.name}>{cat.name}</option>))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Subcategory</label>
                          <select
                            value={editFormData.subCategory}
                            onChange={(e) => setEditFormData({ ...editFormData, subCategory: e.target.value })}
                            disabled={!editFormData.category || availableSubcategories.length === 0}
                            className="w-full px-4 py-2.5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 rounded-xl transition-all font-bold disabled:opacity-50"
                          >
                            <option value="">Select Subcategory</option>
                            {availableSubcategories.map((sub: any) => (<option key={sub} value={sub}>{sub}</option>))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-2 mb-4">
                        <Target className="w-4 h-4 text-indigo-600" />
                        <h3 className="text-sm font-black text-gray-900 uppercase">Priority & Status</h3>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Priority</label>
                          <select
                            value={editFormData.priority}
                            onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 rounded-xl transition-all font-bold"
                          >
                            <option value="high">🔴 High</option>
                            <option value="medium">🟡 Medium</option>
                            <option value="low">🟢 Low</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Status</label>
                          <select
                            value={editFormData.status}
                            onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 rounded-xl transition-all font-bold"
                          >
                            <option value="PENDING">Pending</option>
                            <option value="COMPLETED">Completed</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Location & Assignment */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                      <Briefcase className="w-4 h-4 text-indigo-600" />
                      <h3 className="text-sm font-black text-gray-900 uppercase">Location & Assignment</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Location</label>
                        <select
                          value={editFormData.location}
                          onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                          className="w-full px-4 py-2.5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 rounded-xl transition-all font-bold"
                        >
                          <option value="">Select Location</option>
                          {hierarchicalLocations.map((loc, idx) => (
                            <option key={idx} value={loc.fullPath}>
                              {Array(loc.depth).fill("\u00A0\u00A0").join("")}
                              {loc.depth > 0 ? "└ " : ""}{loc.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Assigned Agency</label>
                        <select
                          value={editFormData.agencyName}
                          onChange={(e) => setEditFormData({ ...editFormData, agencyName: e.target.value })}
                          className="w-full px-4 py-2.5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 rounded-xl transition-all font-bold"
                        >
                          <option value="In-House Team">In-House Team</option>
                          {agencies.map((agency: any) => (<option key={agency._id} value={agency.name}>{agency.name}</option>))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Media Uploads */}
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Camera className="w-4 h-4 text-indigo-600" />
                        <h3 className="text-sm font-black text-gray-900 uppercase">Media & Attachments</h3>
                      </div>
                      {uploadingFiles && (
                         <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 animate-pulse">
                           <Loader2 className="w-3 h-3 animate-spin" /> {uploadProgress}
                         </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Photos */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Photos ({editFormData.photos?.length})</span>
                          <label className="p-1 hover:bg-indigo-50 text-indigo-600 rounded-lg cursor-pointer transition-all">
                            <Plus size={16} />
                            <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => handleFileUpload(e, 'photos')} disabled={uploadingFiles} />
                          </label>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {editFormData.photos?.map((url, idx) => (
                            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-100 group">
                              <img src={url} className="w-full h-full object-cover" />
                              <button onClick={() => removeAttachment(url, 'photos')} className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"><X size={8} /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Videos & Docs simplified for modal */}
                      <div className="md:col-span-2 space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Videos ({editFormData.videos?.length})</span>
                            <label className="p-1 hover:bg-indigo-50 text-indigo-600 rounded-lg cursor-pointer transition-all"><Plus size={16} /><input type="file" className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e, 'videos')} disabled={uploadingFiles} /></label>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {editFormData.videos?.map((url, idx) => (
                              <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg text-[10px] font-bold text-gray-600 border border-gray-100">
                                <Video size={12} /> Video {idx + 1}
                                <button onClick={() => removeAttachment(url, 'videos')} className="text-rose-500 hover:text-rose-700"><Trash2 size={12} /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Documents ({editFormData.documents?.length})</span>
                            <label className="p-1 hover:bg-indigo-50 text-indigo-600 rounded-lg cursor-pointer transition-all"><Plus size={16} /><input type="file" className="hidden" multiple onChange={(e) => handleFileUpload(e, 'documents')} disabled={uploadingFiles} /></label>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {editFormData.documents?.map((url, idx) => (
                              <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg text-[10px] font-bold text-gray-600 border border-gray-100">
                                <FileText size={12} /> {url.split('/').pop()?.slice(-10)}
                                <button onClick={() => removeAttachment(url, 'documents')} className="text-rose-500 hover:text-rose-700"><Trash2 size={12} /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sticky Footer */}
                <div className="sticky bottom-0 bg-white/90 backdrop-blur-md border-t border-gray-100 px-8 py-6 rounded-b-3xl flex items-center justify-end gap-3">
                  <button onClick={() => setIsEditMode(false)} className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all">Cancel</button>
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch(`/api/tickets/${selectedTicket.ticketId}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                             ...editFormData,
                             agencyDate: editFormData.agencyDate || null,
                             agencyTime: editFormData.agencyTime || null,
                          }),
                        });
                        if (!response.ok) throw new Error('Failed to update');
                        await mutate();
                        setSelectedTicketId(null);
                        setIsEditMode(false);
                      } catch (error) {
                        alert('Error updating ticket');
                      }
                    }}
                    className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
                  >
                    <CheckCircle2 size={18} /> SAVE CHANGES
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
