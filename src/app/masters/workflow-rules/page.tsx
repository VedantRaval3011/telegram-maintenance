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
    <div className="min-h-screen bg-[#ecfdf5] font-sans pb-20">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-emerald-950">Workflow Rules</h1>
            <p className="text-emerald-700/80 mt-1">Configure dynamic wizard flows for each category</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/masters/workflow-rules/preview"
              className="flex items-center gap-2 bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-xl font-medium transition-all"
            >
              <Eye className="w-5 h-5" />
              Button View
            </Link>
            <Link
              href="/masters/workflow-rules/preview-expanded"
              className="flex items-center gap-2 bg-white border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 px-4 py-2.5 rounded-xl font-medium transition-all"
            >
              <Eye className="w-5 h-5" />
              Expanded View
            </Link>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-emerald-200 hover:shadow-emerald-300"
            >
              <Plus className="w-5 h-5" />
              New Rule
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/60 backdrop-blur-md border border-emerald-100 rounded-xl text-emerald-900 placeholder-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
            <p className="mt-4 text-emerald-600">Loading rules...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRules.map((rule) => (
              <div key={rule._id} className="bg-white/60 backdrop-blur-md border border-emerald-100 rounded-2xl p-6 hover:shadow-lg hover:shadow-emerald-100/50 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <Settings className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-emerald-950">{(rule.categoryId as ICategory)?.displayName || "Unknown Category"}</h3>
                      <p className="text-xs text-emerald-600/70">{(rule.categoryId as ICategory)?.name}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenModal(rule)} className="p-2 hover:bg-emerald-100 rounded-lg text-emerald-600 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(rule._id!)} className="p-2 hover:bg-red-100 rounded-lg text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {rule.hasSubcategories && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                        <Layers className="w-3 h-3" /> Subcats
                      </span>
                    )}
                    {rule.requiresLocation && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 text-xs font-medium border border-purple-100">
                        <MapPin className="w-3 h-3" /> Location
                      </span>
                    )}
                    {(rule.requiresSourceLocation || rule.requiresTargetLocation) && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 text-xs font-medium border border-orange-100">
                        <Truck className="w-3 h-3" /> Transfer
                      </span>
                    )}
                    {rule.requiresAgency && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 text-xs font-medium border border-rose-100">
                        <Users className="w-3 h-3" /> Agency
                      </span>
                    )}
                  </div>

                  {rule.additionalFields.length > 0 && (
                    <div className="pt-3 border-t border-emerald-50">
                      <p className="text-xs font-medium text-emerald-800 mb-2">Additional Fields:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {rule.additionalFields.map((f, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-emerald-100/50 text-emerald-700 text-[10px] border border-emerald-100">
                            {f.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/20 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-emerald-50/50">
                <h2 className="text-xl font-bold text-emerald-950">
                  {editingRule ? "Edit Workflow Rule" : "Create Workflow Rule"}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* Category Selection */}
                <div>
                  <label className="block text-sm font-medium text-emerald-900 mb-2">Category</label>
                  <select
                    value={formData.categoryId as string}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                    disabled={!!editingRule} // Disable changing category when editing
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
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-emerald-900">Additional Dynamic Fields</h3>
                    <button
                      onClick={addField}
                      className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add Field
                    </button>
                  </div>

                  {formData.additionalFields.map((field, idx) => (
                    <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative group">
                      <button
                        onClick={() => removeField(idx)}
                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <label className="text-xs text-slate-500 font-medium uppercase">Key (Internal)</label>
                          <input
                            type="text"
                            value={field.key}
                            onChange={(e) => updateField(idx, { key: e.target.value })}
                            placeholder="e.g. paintType"
                            className="w-full mt-1 p-2 text-sm border border-slate-200 rounded-lg focus:border-emerald-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 font-medium uppercase">Label (User Facing)</label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateField(idx, { label: e.target.value })}
                            placeholder="e.g. Paint Type"
                            className="w-full mt-1 p-2 text-sm border border-slate-200 rounded-lg focus:border-emerald-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-500 font-medium uppercase">Type</label>
                          <select
                            value={field.type}
                            onChange={(e) => updateField(idx, { type: e.target.value as any })}
                            className="w-full mt-1 p-2 text-sm border border-slate-200 rounded-lg focus:border-emerald-500 outline-none bg-white"
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
                            <label className="text-xs text-slate-500 font-medium uppercase">Options (Comma sep)</label>
                            <input
                              type="text"
                              value={field.options?.join(", ") || ""}
                              onChange={(e) => updateField(idx, { options: e.target.value.split(",").map(s => s.trim()) })}
                              placeholder="Option 1, Option 2"
                              className="w-full mt-1 p-2 text-sm border border-slate-200 rounded-lg focus:border-emerald-500 outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {formData.additionalFields.length === 0 && (
                    <div className="text-center py-6 text-slate-400 text-sm bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      No additional fields configured
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transition-all flex items-center gap-2"
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
          ? "bg-emerald-50 border-emerald-200 ring-1 ring-emerald-500/30" 
          : "bg-white border-slate-200 hover:border-emerald-200 hover:bg-slate-50"
      }`}
    >
      <div className={`mt-0.5 p-1.5 rounded-lg ${checked ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-center">
          <h4 className={`text-sm font-semibold ${checked ? "text-emerald-900" : "text-slate-700"}`}>{label}</h4>
          <div className={`w-10 h-5 rounded-full relative transition-colors ${checked ? "bg-emerald-500" : "bg-slate-300"}`}>
            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${checked ? "left-6" : "left-1"}`} />
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-1">{description}</p>
      </div>
    </div>
  );
}
