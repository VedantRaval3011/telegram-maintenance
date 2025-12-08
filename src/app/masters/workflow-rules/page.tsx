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
  Check, 
  AlertCircle,
  ArrowRight,
  Settings,
  Layers,
  MapPin,
  Truck,
  Users,
  Calendar,
  Eye
} from "lucide-react";
import { toast } from "react-hot-toast";
import Link from "next/link";

interface ICategory {
  _id: string;
  name: string;
  displayName: string;
}

interface IAdditionalField {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "photo" | "select";
  options?: string[]; // for select
}

interface IWorkflowRule {
  _id?: string;
  categoryId: string | ICategory;
  hasSubcategories: boolean;
  requiresLocation: boolean;
  requiresSourceLocation: boolean;
  requiresTargetLocation: boolean;
  requiresAgency: boolean;
  requiresAgencyDate: boolean;
  additionalFields: IAdditionalField[];
}

export default function WorkflowRulesPage() {
  const [rules, setRules] = useState<IWorkflowRule[]>([]);
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<IWorkflowRule | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<IWorkflowRule>({
    categoryId: "",
    hasSubcategories: false,
    requiresLocation: false,
    requiresSourceLocation: false,
    requiresTargetLocation: false,
    requiresAgency: false,
    requiresAgencyDate: false,
    additionalFields: []
  });

  // Fetch data
  useEffect(() => {
    fetchRules();
    fetchCategories();
  }, []);

  const fetchRules = async () => {
    try {
      const res = await fetch("/api/masters/workflow-rules");
      const data = await res.json();
      if (data.success) {
        setRules(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch rules", error);
      toast.error("Failed to load workflow rules");
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

  const handleOpenModal = (rule?: IWorkflowRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        ...rule,
        categoryId: (rule.categoryId as ICategory)._id, // Extract ID if populated
      });
    } else {
      setEditingRule(null);
      setFormData({
        categoryId: "",
        hasSubcategories: false,
        requiresLocation: false,
        requiresSourceLocation: false,
        requiresTargetLocation: false,
        requiresAgency: false,
        requiresAgencyDate: false,
        additionalFields: []
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.categoryId) {
      toast.error("Please select a category");
      return;
    }

    try {
      const res = await fetch("/api/masters/workflow-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success(editingRule ? "Rule updated successfully" : "Rule created successfully");
        setIsModalOpen(false);
        fetchRules();
      } else {
        toast.error(data.error || "Failed to save rule");
      }
    } catch (error) {
      console.error("Error saving rule", error);
      toast.error("An error occurred");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;
    
    try {
      const res = await fetch(`/api/masters/workflow-rules?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Rule deleted");
        fetchRules();
      } else {
        toast.error(data.error || "Failed to delete");
      }
    } catch (error) {
      toast.error("Error deleting rule");
    }
  };

  // Helper to add/remove additional fields
  const addField = () => {
    setFormData({
      ...formData,
      additionalFields: [
        ...formData.additionalFields,
        { key: "", label: "", type: "text", options: [] }
      ]
    });
  };

  const updateField = (index: number, field: Partial<IAdditionalField>) => {
    const newFields = [...formData.additionalFields];
    newFields[index] = { ...newFields[index], ...field };
    setFormData({ ...formData, additionalFields: newFields });
  };

  const removeField = (index: number) => {
    const newFields = [...formData.additionalFields];
    newFields.splice(index, 1);
    setFormData({ ...formData, additionalFields: newFields });
  };

  // Filter rules
  const filteredRules = rules.filter(r => {
    const catName = (r.categoryId as ICategory)?.displayName || "";
    return catName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-white pb-20">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900">
              Workflow Rules
            </h1>
            <p className="text-gray-600 mt-2 text-sm font-medium">
              Configure dynamic wizard flows for each category
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/masters/workflow-rules/preview"
              className="inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-900 px-4 py-3 rounded-xl font-bold border-2 border-gray-200 transition-all active:scale-95"
            >
              <Eye className="w-5 h-5" />
              Button View
            </Link>
            <Link
              href="/masters/workflow-rules/preview-expanded"
              className="inline-flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-3 rounded-xl font-bold border-2 border-gray-300 transition-all active:scale-95"
            >
              <Eye className="w-5 h-5" />
              Expanded View
            </Link>
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-gray-900/20 transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" />
              New Rule
            </button>
          </div>
        </div>

        {/* Search Toolbar */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-8 shadow-sm">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              placeholder="Search by category..."
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
              <p className="mt-4 text-gray-600">Loading rules...</p>
            </div>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
            <div className="text-center py-16">
              <p className="text-gray-600 mb-4">No workflow rules found</p>
              <button
                onClick={() => handleOpenModal()}
                className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-bold shadow-lg"
              >
                Create First Rule
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRules.map((rule) => (
              <div key={rule._id} className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl hover:border-gray-300 transition-all group">
                <div className="p-6">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700 border border-gray-200">
                        <Settings className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{(rule.categoryId as ICategory)?.displayName || "Unknown Category"}</h3>
                        <p className="text-xs text-gray-600 font-mono">{(rule.categoryId as ICategory)?.name}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleOpenModal(rule)} 
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(rule._id!)} 
                        className="p-2 hover:bg-rose-100 rounded-lg text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {rule.hasSubcategories && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200">
                          <Layers className="w-3 h-3" /> Subcats
                        </span>
                      )}
                      {rule.requiresLocation && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 text-xs font-medium border border-purple-200">
                          <MapPin className="w-3 h-3" /> Location
                        </span>
                      )}
                      {(rule.requiresSourceLocation || rule.requiresTargetLocation) && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
                          <Truck className="w-3 h-3" /> Transfer
                        </span>
                      )}
                      {rule.requiresAgency && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200">
                          <Users className="w-3 h-3" /> Agency
                        </span>
                      )}
                    </div>

                    {rule.additionalFields.length > 0 && (
                      <div className="pt-3 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Additional Fields</p>
                        <div className="flex flex-wrap gap-1.5">
                          {rule.additionalFields.map((f, i) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-gray-100 text-gray-900 text-[10px] border border-gray-200 font-medium">
                              {f.label}
                            </span>
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

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingRule ? "Edit Workflow Rule" : "Create Workflow Rule"}
                </h2>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* Category Selection */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Category</label>
                  <select
                    value={formData.categoryId as string}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                    disabled={!!editingRule}
                  >
                    <option value="">Select a Category</option>
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.displayName} ({cat.name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Toggles Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Toggle
                    label="Has Subcategories"
                    description="Ask user to select a subcategory"
                    checked={formData.hasSubcategories}
                    onChange={(v) => setFormData({ ...formData, hasSubcategories: v })}
                    icon={<Layers className="w-4 h-4" />}
                  />
                  <Toggle
                    label="Requires Location"
                    description="Standard building/floor/room selection"
                    checked={formData.requiresLocation}
                    onChange={(v) => setFormData({ ...formData, requiresLocation: v })}
                    icon={<MapPin className="w-4 h-4" />}
                  />
                  <Toggle
                    label="Source Location (From)"
                    description="For transfers/shifting"
                    checked={formData.requiresSourceLocation}
                    onChange={(v) => setFormData({ ...formData, requiresSourceLocation: v })}
                    icon={<Truck className="w-4 h-4" />}
                  />
                  <Toggle
                    label="Target Location (To)"
                    description="For transfers/shifting"
                    checked={formData.requiresTargetLocation}
                    onChange={(v) => setFormData({ ...formData, requiresTargetLocation: v })}
                    icon={<Truck className="w-4 h-4" />}
                  />
                  <Toggle
                    label="Requires Agency Info"
                    description="Ask if agency is handling this"
                    checked={formData.requiresAgency}
                    onChange={(v) => setFormData({ ...formData, requiresAgency: v })}
                    icon={<Users className="w-4 h-4" />}
                  />
                  {formData.requiresAgency && (
                    <Toggle
                      label="Requires Agency Date"
                      description="If agency yes, ask for date"
                      checked={formData.requiresAgencyDate}
                      onChange={(v) => setFormData({ ...formData, requiresAgencyDate: v })}
                      icon={<Calendar className="w-4 h-4" />}
                    />
                  )}
                </div>

                {/* Additional Fields */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-gray-900">Additional Dynamic Fields</h3>
                    <button
                      onClick={addField}
                      className="text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add Field
                    </button>
                  </div>

                  {formData.additionalFields.map((field, idx) => (
                    <div key={idx} className="bg-gray-50 p-4 rounded-xl border border-gray-200 relative group">
                      <button
                        onClick={() => removeField(idx)}
                        className="absolute top-2 right-2 text-gray-600 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <label className="text-xs text-gray-700 font-medium uppercase">Key (Internal)</label>
                          <input
                            type="text"
                            value={field.key}
                            onChange={(e) => updateField(idx, { key: e.target.value })}
                            placeholder="e.g. paintType"
                            className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg focus:border-gray-400 outline-none bg-white text-gray-900"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-700 font-medium uppercase">Label (User Facing)</label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateField(idx, { label: e.target.value })}
                            placeholder="e.g. Paint Type"
                            className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg focus:border-gray-400 outline-none bg-white text-gray-900"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-gray-700 font-medium uppercase">Type</label>
                          <select
                            value={field.type}
                            onChange={(e) => updateField(idx, { type: e.target.value as any })}
                            className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg focus:border-gray-400 outline-none bg-white text-gray-900"
                          >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="select">Select (Dropdown)</option>
                            <option value="photo">Photo</option>
                          </select>
                        </div>
                        {field.type === "select" && (
                          <div>
                            <label className="text-xs text-gray-700 font-medium uppercase">Options (Comma sep)</label>
                            <input
                              type="text"
                              value={field.options?.join(", ") || ""}
                              onChange={(e) => updateField(idx, { options: e.target.value.split(",").map(s => s.trim()) })}
                              placeholder="Option 1, Option 2"
                              className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg focus:border-gray-400 outline-none bg-white text-gray-900"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {formData.additionalFields.length === 0 && (
                    <div className="text-center py-6 text-gray-600 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-300">
                      No additional fields configured
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
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

function Toggle({ label, description, checked, onChange, icon }: { label: string, description: string, checked: boolean, onChange: (v: boolean) => void, icon: React.ReactNode }) {
  return (
    <div 
      onClick={() => onChange(!checked)}
      className={`cursor-pointer p-4 rounded-xl border transition-all flex items-start gap-3 ${
        checked 
          ? "bg-gray-100 border-gray-300 ring-1 ring-gray-400" 
          : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className={`mt-0.5 p-1.5 rounded-lg ${checked ? "bg-gray-200 text-gray-700" : "bg-gray-100 text-gray-500"}`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-center">
          <h4 className={`text-sm font-semibold ${checked ? "text-gray-900" : "text-gray-700"}`}>{label}</h4>
          <div className={`w-10 h-5 rounded-full relative transition-colors ${checked ? "bg-gray-700" : "bg-gray-300"}`}>
            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${checked ? "left-6" : "left-1"}`} />
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-1">{description}</p>
      </div>
    </div>
  );
}