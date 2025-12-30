"use client";
// app/admin/page.tsx
import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Shield,
  ShieldCheck,
  Eye,
  EyeOff,
  X,
  Check,
  Loader2,
  AlertCircle,
  Lock,
  User,
  Mail,
  RefreshCw,
  MapPin,
  Clock,
  PenOff,
  CornerDownRight,
} from "lucide-react";

interface AdminUserData {
  _id: string;
  username: string;
  displayName: string;
  email?: string;
  isSuperAdmin: boolean;
  permissions: string[];
  // Access control
  allowedLocationIds?: string[];
  isReadOnly?: boolean;
  hideTimeDetails?: boolean;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

interface LocationData {
  _id: string;
  name: string;
  parentLocationId?: string | null;
}

interface LocationNode extends LocationData {
  children: LocationNode[];
}

// Helper to extract parent ID from either string or populated object
function getParentId(parentLocationId: any): string | null {
  if (!parentLocationId) return null;
  // If it's already a string, return it
  if (typeof parentLocationId === 'string') return parentLocationId;
  // If it's a populated object, extract _id
  if (typeof parentLocationId === 'object' && parentLocationId._id) {
    return parentLocationId._id.toString();
  }
  return null;
}

// Build hierarchical tree from flat locations array
function buildLocationTree(locations: LocationData[]): LocationNode[] {
  const locationMap = new Map<string, LocationNode>();
  const rootNodes: LocationNode[] = [];

  // First pass: create nodes with empty children
  locations.forEach(loc => {
    locationMap.set(loc._id, { ...loc, children: [] });
  });

  // Second pass: build tree structure
  locations.forEach(loc => {
    const node = locationMap.get(loc._id)!;
    const parentId = getParentId(loc.parentLocationId);
    
    if (parentId && locationMap.has(parentId)) {
      locationMap.get(parentId)!.children.push(node);
    } else {
      rootNodes.push(node);
    }
  });

  // Sort by name at each level
  const sortNodes = (nodes: LocationNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach(node => sortNodes(node.children));
  };
  sortNodes(rootNodes);

  return rootNodes;
}

// Recursive component to render hierarchical location tree
function LocationTreeSelector({ 
  nodes, 
  selectedIds, 
  onToggle, 
  depth 
}: { 
  nodes: LocationNode[]; 
  selectedIds: string[]; 
  onToggle: (id: string) => void; 
  depth: number; 
}) {
  return (
    <div className={depth > 0 ? "ml-4 border-l-2 border-slate-200 pl-2" : ""}>
      {nodes.map((node) => (
        <div key={node._id}>
          <label
            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors mb-1 ${
              selectedIds.includes(node._id)
                ? "bg-rose-100 border border-rose-300"
                : "bg-white border border-slate-200 hover:bg-slate-100"
            }`}
          >
            {depth > 0 && (
              <CornerDownRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            )}
            <input
              type="checkbox"
              checked={selectedIds.includes(node._id)}
              onChange={() => onToggle(node._id)}
              className="sr-only"
            />
            <div
              className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                selectedIds.includes(node._id)
                  ? "bg-rose-600 border-rose-600"
                  : "border-slate-300"
              }`}
            >
              {selectedIds.includes(node._id) && (
                <Check className="w-3 h-3 text-white" />
              )}
            </div>
            <span className="text-sm text-slate-700">{node.name}</span>
          </label>
          {node.children.length > 0 && (
            <LocationTreeSelector
              nodes={node.children}
              selectedIds={selectedIds}
              onToggle={onToggle}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </div>
  );
}

interface SectionInfo {
  label: string;
  path: string;
}

export default function AdminPage() {
  const { user, hasPermission } = useAuth();
  const [users, setUsers] = useState<AdminUserData[]>([]);
  const [sections, setSections] = useState<Record<string, SectionInfo>>({});
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserData | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    displayName: "",
    email: "",
    password: "",
    isSuperAdmin: false,
    permissions: [] as string[],
    // Access control
    allowedLocationIds: [] as string[],
    isReadOnly: false,
    hideTimeDetails: false,
    isActive: true,
  });
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError("");
      const [usersRes, locationsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/masters/locations?limit=500")
      ]);
      
      const usersData = await usersRes.json();
      const locationsData = await locationsRes.json();

      if (usersData.error) {
        throw new Error(usersData.error);
      }

      setUsers(usersData.users || []);
      setSections(usersData.sections || {});
      setLocations(locationsData.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasPermission("admin")) {
      fetchUsers();
    }
  }, [hasPermission]);

  const openModal = (userToEdit?: AdminUserData) => {
    if (userToEdit) {
      setEditingUser(userToEdit);
      setFormData({
        username: userToEdit.username,
        displayName: userToEdit.displayName,
        email: userToEdit.email || "",
        password: "",
        isSuperAdmin: userToEdit.isSuperAdmin,
        permissions: userToEdit.permissions || [],
        // Access control
        allowedLocationIds: userToEdit.allowedLocationIds || [],
        isReadOnly: userToEdit.isReadOnly || false,
        hideTimeDetails: userToEdit.hideTimeDetails || false,
        isActive: userToEdit.isActive,
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: "",
        displayName: "",
        email: "",
        password: "",
        isSuperAdmin: false,
        permissions: [],
        // Access control
        allowedLocationIds: [],
        isReadOnly: false,
        hideTimeDetails: false,
        isActive: true,
      });
    }
    setFormError("");
    setShowPassword(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsSaving(true);

    try {
      const url = editingUser
        ? `/api/admin/users/${editingUser._id}`
        : "/api/admin/users";
      
      const method = editingUser ? "PUT" : "POST";
      
      const body: any = {
        displayName: formData.displayName,
        email: formData.email,
        isSuperAdmin: formData.isSuperAdmin,
        permissions: formData.permissions,
        // Access control
        allowedLocationIds: formData.allowedLocationIds,
        isReadOnly: formData.isReadOnly,
        hideTimeDetails: formData.hideTimeDetails,
        isActive: formData.isActive,
      };

      if (!editingUser) {
        body.username = formData.username;
        body.password = formData.password;
      } else if (formData.password) {
        body.password = formData.password;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      closeModal();
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message || "Failed to save user");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (userId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setDeleteConfirmId(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || "Failed to delete user");
    } finally {
      setIsDeleting(false);
    }
  };

  const togglePermission = (sectionKey: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(sectionKey)
        ? prev.permissions.filter(p => p !== sectionKey)
        : [...prev.permissions, sectionKey],
    }));
  };

  const selectAllPermissions = () => {
    setFormData(prev => ({
      ...prev,
      permissions: Object.keys(sections),
    }));
  };

  const clearAllPermissions = () => {
    setFormData(prev => ({
      ...prev,
      permissions: [],
    }));
  };

  if (!hasPermission("admin")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h1 className="text-xl font-semibold text-slate-700">Access Denied</h1>
          <p className="text-sm text-slate-500 mt-2">You don't have permission to access this section.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <ShieldCheck className="w-7 h-7 text-emerald-600" />
              Super Admin
            </h1>
            <p className="text-sm text-slate-500 mt-1">Manage admin users and their access permissions</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchUsers}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            {user?.isSuperAdmin && (
              <button
                onClick={() => openModal()}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg"
              >
                <Plus className="w-4 h-4" />
                Add User
              </button>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 mb-6">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : (
          /* Users Table */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">User</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Role</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Permissions</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Last Login</th>
                    {user?.isSuperAdmin && (
                      <th className="text-right px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                        <p>No admin users found</p>
                      </td>
                    </tr>
                  ) : (
                    users.map((adminUser) => (
                      <tr key={adminUser._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-slate-900">{adminUser.displayName}</div>
                            <div className="text-sm text-slate-500">@{adminUser.username}</div>
                            {adminUser.email && (
                              <div className="text-xs text-slate-400">{adminUser.email}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {adminUser.isSuperAdmin ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                              <ShieldCheck className="w-3 h-3" />
                              Super Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                              <User className="w-3 h-3" />
                              Admin
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {adminUser.isSuperAdmin ? (
                            <span className="text-sm text-slate-500">All Access</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {adminUser.permissions.slice(0, 3).map((p) => (
                                <span key={p} className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs">
                                  {sections[p]?.label || p}
                                </span>
                              ))}
                              {adminUser.permissions.length > 3 && (
                                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 text-xs">
                                  +{adminUser.permissions.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {adminUser.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                              <Check className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                              <X className="w-3 h-3" />
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {adminUser.lastLoginAt
                            ? new Date(adminUser.lastLoginAt).toLocaleDateString()
                            : "Never"}
                        </td>
                        {user?.isSuperAdmin && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openModal(adminUser)}
                                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {deleteConfirmId === adminUser._id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleDelete(adminUser._id)}
                                    disabled={isDeleting}
                                    className="p-2 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                                    title="Confirm Delete"
                                  >
                                    {isDeleting ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Check className="w-4 h-4" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="p-2 text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200"
                                    title="Cancel"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirmId(adminUser._id)}
                                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingUser ? "Edit User" : "Add New User"}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {formError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Username (only for new users) */}
                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Username *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="block w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter username"
                        required
                        minLength={3}
                      />
                    </div>
                  </div>
                )}

                {/* Display Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="block w-full px-4 py-2.5 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter display name"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email (optional)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="block w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Password {editingUser ? "(leave blank to keep current)" : "*"}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="block w-full pl-10 pr-12 py-2.5 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder={editingUser ? "Enter new password" : "Enter password"}
                      required={!editingUser}
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Super Admin Toggle */}
                <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <div>
                      <div className="font-medium text-slate-900">Super Admin</div>
                      <div className="text-xs text-slate-500">Full access to all sections</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isSuperAdmin: !formData.isSuperAdmin })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.isSuperAdmin ? "bg-emerald-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isSuperAdmin ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Permissions */}
                {!formData.isSuperAdmin && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-slate-700">
                        Section Permissions
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={selectAllPermissions}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={clearAllPermissions}
                          className="text-xs text-slate-500 hover:underline"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-4 bg-slate-50 border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
                      {Object.entries(sections).map(([key, section]) => (
                        <label
                          key={key}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                            formData.permissions.includes(key)
                              ? "bg-blue-100 border border-blue-300"
                              : "bg-white border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(key)}
                            onChange={() => togglePermission(key)}
                            className="sr-only"
                          />
                          <div
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                              formData.permissions.includes(key)
                                ? "bg-blue-600 border-blue-600"
                                : "border-slate-300"
                            }`}
                          >
                            {formData.permissions.includes(key) && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <span className="text-sm text-slate-700">{section.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <div className="font-medium text-slate-900">Active Status</div>
                    <div className="text-xs text-slate-500">Inactive users cannot log in</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.isActive ? "bg-green-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isActive ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Access Control Section - Only for non-super-admin users */}
                {!formData.isSuperAdmin && (
                  <>
                    {/* Section Header */}
                    <div className="border-t border-slate-200 pt-5 mt-2">
                      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-amber-600" />
                        Access Restrictions
                      </h3>
                    </div>

                    {/* Read-Only Toggle */}
                    <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="flex items-center gap-3">
                        <PenOff className="w-5 h-5 text-amber-600" />
                        <div>
                          <div className="font-medium text-slate-900">Read-Only Mode</div>
                          <div className="text-xs text-slate-500">Cannot edit, delete, or complete tickets</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isReadOnly: !formData.isReadOnly })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          formData.isReadOnly ? "bg-amber-600" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            formData.isReadOnly ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Hide Time Details Toggle */}
                    <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-purple-600" />
                        <div>
                          <div className="font-medium text-slate-900">Hide Time Details</div>
                          <div className="text-xs text-slate-500">Time info hidden on tickets</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, hideTimeDetails: !formData.hideTimeDetails })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          formData.hideTimeDetails ? "bg-purple-600" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            formData.hideTimeDetails ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Location Restrictions - Only show when user has location-based permissions */}
                    {(formData.permissions.includes('dashboard') || formData.permissions.includes('locations')) && (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin className="w-4 h-4 text-rose-600" />
                          <label className="block text-sm font-medium text-slate-700">
                            Allowed Locations
                          </label>
                          <span className="text-xs text-slate-400">(empty = all locations)</span>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-64 overflow-y-auto">
                          {locations.length === 0 ? (
                            <div className="text-center text-sm text-slate-400 py-4">
                              No locations found
                            </div>
                          ) : (
                            <LocationTreeSelector
                              nodes={buildLocationTree(locations)}
                              selectedIds={formData.allowedLocationIds}
                              onToggle={(id) => {
                                setFormData(prev => ({
                                  ...prev,
                                  allowedLocationIds: prev.allowedLocationIds.includes(id)
                                    ? prev.allowedLocationIds.filter(locId => locId !== id)
                                    : [...prev.allowedLocationIds, id]
                                }));
                              }}
                              depth={0}
                            />
                          )}
                        </div>
                        {formData.allowedLocationIds.length > 0 && (
                          <div className="mt-2 text-xs text-slate-500">
                            {formData.allowedLocationIds.length} location(s) selected - child locations automatically included
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Submit Button */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        {editingUser ? "Update User" : "Create User"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
