"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import Navbar from "@/components/Navbar";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  CornerDownRight, 
  X,
  MoreVertical
} from "lucide-react";

// --- Types ---
interface Location {
  _id: string;
  name: string;
  type?: string;
  code?: string;
  description?: string;
  isActive: boolean;
  capacity?: number | null;
  parentLocationId?: any;
  createdAt: string;
  updatedAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function LocationMasterPage() {
  // --- State ---
  const [page, setPage] = useState(1);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState(""); // Immediate input
  const [debouncedSearch, setDebouncedSearch] = useState(""); // Delayed query
  const [typeFilter, setTypeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  
  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // UI Interaction State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; loc: Location } | null>(null);
  const [mobileSelectedId, setMobileSelectedId] = useState<string | null>(null); // For mobile tap-to-show-actions
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [formData, setFormData] = useState<any>({
    name: "",
    type: "",
    code: "",
    description: "",
    capacity: "",
    isActive: true,
    parentLocationId: null,
  });

  // --- Debounce Search ---
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 400); // 400ms delay
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // --- Close Context Menu on Click ---
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  // --- Data Fetching ---
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: "200",
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(typeFilter && { type: typeFilter }),
    ...(activeFilter && { isActive: activeFilter }),
  });

  const { data, error, mutate } = useSWR(
    `/api/masters/locations?${queryParams}`,
    fetcher
  );

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // --- Helpers ---
  function getDepth(loc: Location, allLocs: Location[]) {
    let depth = 0;
    let current: Location | null = loc;
    while (current?.parentLocationId) {
      depth++;
      current = allLocs.find((x) => x._id === current?.parentLocationId?._id) || null;
    }
    return depth;
  }

  function sortByHierarchy(locList: Location[]) {
    const map = new Map<string, Location[]>();
    locList.forEach((loc) => {
      const parent = loc.parentLocationId?._id || "root";
      if (!map.has(parent)) map.set(parent, []);
      map.get(parent)!.push(loc);
    });

    const result: Location[] = [];
    function traverse(parentId: string | null) {
      const children = map.get(parentId || "root") || [];
      children.sort((a, b) => a.name.localeCompare(b.name));
      for (const child of children) {
        result.push(child);
        traverse(child._id);
      }
    }
    traverse(null);
    return result;
  }

  const locationsRaw = data?.data || [];
  const locations: Location[] = sortByHierarchy(locationsRaw);

  // --- Actions ---
  const handleDelete = async () => {
    if (!deleteTargetId) return;
    const res = await fetch(`/api/masters/locations/${deleteTargetId}`, { method: "DELETE" });
    
    if (res.ok) {
      mutate();
      setToast({ msg: "Location deleted successfully", type: "success" });
    } else {
      const d = await res.json();
      setToast({ msg: d.error || "Failed to delete", type: "error" });
    }
    setDeleteTargetId(null);
  };

  const handleSave = async (e: any) => {
    e.preventDefault();
    const body = {
      ...formData,
      type: formData.type || null,
      code: formData.code || null,
      description: formData.description || null,
      capacity: formData.capacity ? Number(formData.capacity) : null,
      parentLocationId: formData.parentLocationId === "" ? null : formData.parentLocationId,
    };

    const url = editingId 
      ? `/api/masters/locations/${editingId}` 
      : "/api/masters/locations";
    
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const r = await res.json();
    if (res.ok) {
      mutate();
      setToast({ 
        msg: editingId ? "Location updated successfully" : "Location created successfully", 
        type: "success" 
      });
      setIsCreateModalOpen(false);
      resetForm();
    } else {
      setToast({ msg: r.error || "Failed to save", type: "error" });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "",
      code: "",
      description: "",
      capacity: "",
      isActive: true,
      parentLocationId: null,
    });
    setEditingId(null);
  };

  const openCreateModal = (parentId: string | null = null) => {
    resetForm();
    if (parentId) setFormData((prev: any) => ({ ...prev, parentLocationId: parentId }));
    setIsCreateModalOpen(true);
  };

  const openEditModal = (loc: Location) => {
    resetForm();
    setEditingId(loc._id);
    setFormData({
      name: loc.name,
      type: loc.type || "",
      code: loc.code || "",
      description: loc.description || "",
      capacity: loc.capacity || "",
      isActive: loc.isActive,
      parentLocationId: loc.parentLocationId?._id || loc.parentLocationId || null,
    });
    setIsCreateModalOpen(true);
  };

  const handleContextMenu = (e: React.MouseEvent, loc: Location) => {
    e.preventDefault();
    setContextMenu({ x: e.pageX, y: e.pageY, loc });
  };

  const handleMobileRowClick = (locId: string) => {
    // Toggle selection on mobile
    if (mobileSelectedId === locId) {
      setMobileSelectedId(null);
    } else {
      setMobileSelectedId(locId);
    }
  };

  // --- Render ---

  if (error) return <div className="p-10 text-center text-rose-500">Failed to load data.</div>;
  if (!data) return <div className="p-10 text-center text-amber-700 animate-pulse">Loading locations...</div>;

  return (
    <div className="min-h-screen bg-[#e8d5c4] pb-20 font-sans">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-4xl font-extrabold text-[#2c2420] tracking-tight">
              Locations
            </h1>
            <p className="text-[#5c4a3d] mt-2 text-sm font-medium">
              Manage your building hierarchy and spaces
            </p>
          </div>
          <button
            onClick={() => openCreateModal()}
            className="inline-flex items-center justify-center gap-2 bg-[#2c2420] hover:bg-[#3d332c] text-[#f5ebe0] px-6 py-3 rounded-xl font-bold shadow-lg shadow-[#2c2420]/20 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>Add Location</span>
          </button>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="bg-[#d4c0ae]/50 backdrop-blur-md border border-[#b8a293] rounded-2xl p-4 mb-8 flex flex-col md:flex-row gap-4 items-center shadow-sm">
          <div className="relative flex-1 w-full group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7d6856] group-focus-within:text-[#5c4a3d] transition-colors">
              <Search className="w-5 h-5" />
            </div>
            <input
              className="pl-10 w-full bg-[#f5ebe0] border border-[#c9b6a5] rounded-xl focus:ring-2 focus:ring-[#7d6856]/40 focus:border-[#7d6856] transition-all py-3 text-sm text-[#2c2420] placeholder-[#9c8672]"
              placeholder="Search locations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            <select
              className="bg-[#f5ebe0] border border-[#c9b6a5] rounded-xl px-4 py-3 text-sm text-[#2c2420] focus:ring-2 focus:ring-[#7d6856]/40 outline-none min-w-[140px] appearance-none cursor-pointer hover:bg-[#ede0d1] transition-colors"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="building">Building</option>
              <option value="floor">Floor</option>
              <option value="room">Room</option>
            </select>
            
            <select
              className="bg-[#f5ebe0] border border-[#c9b6a5] rounded-xl px-4 py-3 text-sm text-[#2c2420] focus:ring-2 focus:ring-[#7d6856]/40 outline-none min-w-[120px] appearance-none cursor-pointer hover:bg-[#ede0d1] transition-colors"
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>

            {(searchTerm || typeFilter || activeFilter) && (
              <button
                onClick={() => { setSearchTerm(""); setTypeFilter(""); setActiveFilter(""); }}
                className="text-sm text-[#5c4a3d] hover:text-[#2c2420] px-4 font-medium transition-colors whitespace-nowrap"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Locations Table */}
        <div className="bg-[#f5ebe0] backdrop-blur-sm border border-[#c9b6a5] rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#d4c0ae] border-b border-[#b8a293] text-xs uppercase tracking-wider text-[#2c2420] font-bold">
                  <th className="px-6 py-5">Location Name</th>
                  <th className="px-6 py-5 hidden md:table-cell">Code</th>
                  <th className="px-6 py-5 hidden sm:table-cell">Type</th>
                  <th className="px-6 py-5 hidden lg:table-cell">Capacity</th>
                  <th className="px-6 py-5">Status</th>
                  <th className="px-6 py-5 text-right hidden md:table-cell">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dccab9]">
                {locations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-[#7d6856] italic">
                      No locations found. Try adjusting your filters.
                    </td>
                  </tr>
                ) : (
                  locations.map((loc) => {
                    const depth = getDepth(loc, locationsRaw);
                    const isMobileSelected = mobileSelectedId === loc._id;

                    return (
                      <tr 
                        key={loc._id} 
                        onContextMenu={(e) => handleContextMenu(e, loc)}
                        className={`group transition-all duration-200 ${
                          isMobileSelected ? "bg-[#e8d5c4]" : "hover:bg-[#ede0d1]"
                        }`}
                      >
                        {/* Name Column - Clickable on Mobile */}
                        <td 
                          className="px-6 py-4 cursor-pointer md:cursor-default"
                          onClick={() => handleMobileRowClick(loc._id)}
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center" style={{ paddingLeft: `${depth * 20}px` }}>
                              {depth > 0 && (
                                <span className="text-[#7d6856] mr-2">
                                  <CornerDownRight className="w-4 h-4" />
                                </span>
                              )}
                              <div className="flex flex-col">
                                <span className={`font-medium text-base ${depth === 0 ? 'text-[#2c2420]' : 'text-[#3d332c]'}`}>
                                  {loc.name}
                                </span>
                                {loc.description && (
                                  <span className="text-[11px] text-[#7d6856] truncate max-w-[200px]">
                                    {loc.description}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Mobile Actions Panel (Visible when selected) */}
                            {isMobileSelected && (
                              <div className="md:hidden flex items-center gap-3 mt-3 pl-2 animate-in slide-in-from-top-2 duration-200">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openEditModal(loc); }}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-[#b8a293] text-[#2c2420] rounded-lg text-xs font-medium border border-[#9c8672]"
                                >
                                  <Edit2 className="w-3 h-3" /> Edit
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openCreateModal(loc._id); }}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-[#7d6856] text-[#f5ebe0] rounded-lg text-xs font-medium"
                                >
                                  <Plus className="w-3 h-3" />Child
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeleteTargetId(loc._id); }}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-rose-700 text-rose-50 rounded-lg text-xs font-medium"
                                >
                                  <Trash2 className="w-3 h-3" /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-sm text-[#5c4a3d] font-mono hidden md:table-cell">{loc.code || "—"}</td>
                        <td className="px-6 py-4 hidden sm:table-cell">
                          {loc.type ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#d4c0ae] text-[#2c2420] text-xs font-medium border border-[#b8a293]">
                              {loc.type}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-6 py-4 text-sm text-[#5c4a3d] hidden lg:table-cell">{loc.capacity || "—"}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            loc.isActive 
                              ? "bg-[#7d6856] text-[#f5ebe0] border-[#5c4a3d]" 
                              : "bg-[#b8a293] border-[#9c8672] text-[#3d332c]"
                          }`}>
                            {loc.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        
                        {/* Desktop Actions */}
                        <td className="px-6 py-4 text-right hidden md:table-cell">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                            <button
                              onClick={() => openEditModal(loc)}
                              className="p-2 text-[#5c4a3d] hover:text-[#2c2420] hover:bg-[#e8d5c4] rounded-lg transition-all"
                              title="Edit Location"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openCreateModal(loc._id)}
                              className="p-2 text-[#5c4a3d] hover:text-[#2c2420] hover:bg-[#e8d5c4] rounded-lg transition-all"
                              title="Add Child Location"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTargetId(loc._id)}
                              className="p-2 text-[#5c4a3d] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Delete Location"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- Context Menu (Right Click) --- */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-[#f5ebe0] backdrop-blur-md border border-[#c9b6a5] rounded-xl shadow-xl py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button 
            onClick={() => { openEditModal(contextMenu.loc); setContextMenu(null); }}
            className="w-full text-left px-4 py-2.5 text-sm text-[#2c2420] hover:bg-[#e8d5c4] hover:text-[#2c2420] flex items-center gap-2"
          >
            <Edit2 className="w-4 h-4" /> Edit
          </button>
          <button 
            onClick={() => { openCreateModal(contextMenu.loc._id); setContextMenu(null); }}
            className="w-full text-left px-4 py-2.5 text-sm text-[#2c2420] hover:bg-[#e8d5c4] hover:text-[#2c2420] flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Child
          </button>
          <div className="h-px bg-[#dccab9] my-1" />
          <button 
            onClick={() => { setDeleteTargetId(contextMenu.loc._id); setContextMenu(null); }}
            className="w-full text-left px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}

      {/* --- Create/Edit Modal --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2c2420]/20 backdrop-blur-sm transition-all">
          <div className="bg-[#f5ebe0] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-[#c9b6a5]">
            <div className="px-6 py-4 border-b border-[#dccab9] flex justify-between items-center bg-[#e8d5c4]">
              <h2 className="text-lg font-bold text-[#2c2420]">
                {editingId 
                  ? "Edit Location" 
                  : formData.parentLocationId 
                    ? "Add Sub-Location" 
                    : "Create New Location"}
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-[#7d6856] hover:text-[#2c2420] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#5c4a3d] mb-1.5 uppercase tracking-wide">Name *</label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#ede0d1] border border-[#c9b6a5] rounded-lg px-3 py-2.5 text-[#2c2420] focus:ring-2 focus:ring-[#7d6856]/20 focus:border-[#7d6856] outline-none transition-all"
                    placeholder="e.g. Main Building"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-[#5c4a3d] mb-1.5 uppercase tracking-wide">Type</label>
                  <input
                    list="location-types"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-[#ede0d1] border border-[#c9b6a5] rounded-lg px-3 py-2.5 text-[#2c2420] focus:ring-2 focus:ring-[#7d6856]/20 focus:border-[#7d6856] outline-none transition-all"
                    placeholder="e.g. Floor"
                  />
                  <datalist id="location-types">
                    <option value="Location" />
                    <option value="Building" />
                    <option value="Floor" />
                    <option value="Room" />
                    <option value="Wing" />
                    <option value="Area" />
                  </datalist>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-[#5c4a3d] mb-1.5 uppercase tracking-wide">Code</label>
                  <input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full bg-[#ede0d1] border border-[#c9b6a5] rounded-lg px-3 py-2.5 text-[#2c2420] focus:ring-2 focus:ring-[#7d6856]/20 focus:border-[#7d6856] outline-none transition-all"
                    placeholder="e.g. BLD-01"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#5c4a3d] mb-1.5 uppercase tracking-wide">Description</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-[#ede0d1] border border-[#c9b6a5] rounded-lg px-3 py-2.5 text-[#2c2420] focus:ring-2 focus:ring-[#7d6856]/20 focus:border-[#7d6856] outline-none transition-all resize-none"
                    placeholder="Optional description..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#5c4a3d] mb-1.5 uppercase tracking-wide">Capacity</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="w-full bg-[#ede0d1] border border-[#c9b6a5] rounded-lg px-3 py-2.5 text-[#2c2420] focus:ring-2 focus:ring-[#7d6856]/20 focus:border-[#7d6856] outline-none transition-all"
                    placeholder="0"
                  />
                </div>

                <div className="flex items-center pt-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-[#c9b6a5] bg-[#ede0d1] checked:bg-[#7d6856] checked:border-[#5c4a3d] transition-all"
                      />
                      <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#f5ebe0] opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" viewBox="0 0 14 14" fill="none">
                        <path d="M3 8L6 11L11 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="text-sm text-[#5c4a3d] group-hover:text-[#2c2420] transition-colors">Active Status</span>
                  </label>
                </div>
              </div>

              {/* Parent Selector (Optional override) */}
              <div className="pt-4 border-t border-[#dccab9] mt-2">
                <label className="block text-xs font-semibold text-[#5c4a3d] mb-1.5 uppercase tracking-wide">Parent Location (Optional)</label>
                <select
                  className="w-full bg-[#ede0d1] border border-[#c9b6a5] rounded-lg px-3 py-2.5 text-[#2c2420] text-sm focus:ring-2 focus:ring-[#7d6856]/20 focus:border-[#7d6856] outline-none transition-all"
                  value={formData.parentLocationId || ""}
                  onChange={(e) => setFormData({ ...formData, parentLocationId: e.target.value || null })}
                >
                  <option value="">No Parent (Top Level)</option>
                  {locations.map((loc) => (
                    <option key={loc._id} value={loc._id}>
                      {Array(getDepth(loc, locationsRaw)).fill("— ").join("")} {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-medium text-[#5c4a3d] hover:bg-[#e8d5c4] rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-bold text-[#f5ebe0] bg-[#2c2420] hover:bg-[#3d332c] rounded-xl shadow-lg shadow-[#2c2420]/20 transition-all active:scale-95"
                >
                  {editingId ? "Update Location" : "Create Location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Delete Confirmation Modal --- */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2c2420]/20 backdrop-blur-sm">
          <div className="bg-[#f5ebe0] rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200 border border-[#c9b6a5]">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-[#2c2420] mb-2">Delete Location?</h3>
              <p className="text-sm text-[#5c4a3d] mb-6">
                Are you sure you want to delete this location? This action cannot be undone.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setDeleteTargetId(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-[#5c4a3d] hover:bg-[#e8d5c4] rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2.5 text-sm font-bold text-rose-50 bg-rose-600 hover:bg-rose-700 rounded-xl shadow-lg shadow-rose-200 transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Toast Notification --- */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-md ${
            toast.type === 'success' 
              ? 'bg-[#7d6856] border-[#5c4a3d] text-[#f5ebe0]' 
              : 'bg-rose-700 border-rose-800 text-rose-50'
          }`}>
            <div className={`w-2.5 h-2.5 rounded-full ${toast.type === 'success' ? 'bg-[#e8d5c4]' : 'bg-rose-200'}`} />
            <span className="text-sm font-medium tracking-wide">{toast.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}
