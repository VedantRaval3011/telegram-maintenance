"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  X, Plus, Trash2, Loader2, CheckCircle2, FileText, Camera, Video,
  ArrowLeft, ArrowRight, Info, Wrench,
} from "lucide-react";

interface HierarchicalLocation {
  name: string;
  fullPath: string;
  depth: number;
}

interface WorkflowRule {
  hasSubcategories?: boolean;
  requiresLocation?: boolean;
  requiresSourceLocation?: boolean;
  requiresTargetLocation?: boolean;
  requiresAgency?: boolean;
  requiresAgencyDate?: boolean;
  requiresAddOrRepair?: boolean;
  additionalFields?: {
    key: string;
    label: string;
    type: "text" | "number" | "date" | "photo" | "select";
    options?: string[];
  }[];
}

interface AddTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  categories: any[];
  subCategories: any[];
  agencies: any[];
  hierarchicalLocations: HierarchicalLocation[];
}

// Mirrors the server limits in /api/tickets/upload-media
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime"];
const ALLOWED_DOC_EXTS = ["pdf", "xlsx", "xls", "docx", "doc", "txt", "rtf", "ppt", "pptx"];
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;
const MAX_DOC = 20 * 1024 * 1024;
const FILE_ACCEPT =
  "image/jpeg,image/png,video/mp4,video/quicktime,.pdf,.xlsx,.xls,.docx,.doc,.txt,.rtf,.ppt,.pptx";

// Returns an error message if the file is not allowed, otherwise null
function validateFile(f: File): string | null {
  const ext = (f.name.split(".").pop() || "").toLowerCase();
  const isImage = ALLOWED_IMAGE_TYPES.includes(f.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(f.type);
  const isDoc = ALLOWED_DOC_EXTS.includes(ext);

  if (!isImage && !isVideo && !isDoc) {
    return `"${f.name}" — unsupported type. Allowed: JPG, PNG, MP4, MOV, PDF, Office docs.`;
  }
  if (isImage && f.size > MAX_IMAGE) return `"${f.name}" — image exceeds 10MB.`;
  if (isVideo && f.size > MAX_VIDEO) return `"${f.name}" — video exceeds 100MB.`;
  if (isDoc && f.size > MAX_DOC) return `"${f.name}" — document exceeds 20MB.`;
  return null;
}

const PRIORITIES = [
  { value: "high", label: "🔴 High", bg: "bg-red-50 text-red-700 border-red-300", active: "bg-red-500 text-white border-red-500" },
  { value: "medium", label: "🟡 Medium", bg: "bg-amber-50 text-amber-700 border-amber-300", active: "bg-amber-500 text-white border-amber-500" },
  { value: "low", label: "🟢 Low", bg: "bg-emerald-50 text-emerald-700 border-emerald-300", active: "bg-emerald-500 text-white border-emerald-500" },
];

const LocationSelect = ({
  value, onChange, locations,
}: {
  value: string;
  onChange: (v: string) => void;
  locations: HierarchicalLocation[];
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    autoFocus
    className="w-full px-4 py-3 bg-purple-50 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium"
  >
    <option value="">Select location…</option>
    {locations.map((loc, idx) => (
      <option key={idx} value={loc.fullPath}>
        {String.fromCharCode(160).repeat(loc.depth * 3)}
        {loc.depth > 0 ? "\u2514\u2500 " : ""}
        {loc.name}
      </option>
    ))}
  </select>
);

// Human-readable title for a step key
function stepTitle(key: string, rule: WorkflowRule | null): string {
  if (key.startsWith("additional:")) {
    const fk = key.split(":")[1];
    return rule?.additionalFields?.find((f) => f.key === fk)?.label || "Additional";
  }
  switch (key) {
    case "description": return "📝 Description & Media";
    case "info_type": return "ℹ️ Information Type";
    case "category": return "📂 Category";
    case "subcategory": return "🧩 Subcategory";
    case "add_or_repair": return "🔧 Add New or Repair";
    case "location": return "📍 Location";
    case "source_location": return "📍 Source Location (From)";
    case "target_location": return "📍 Target Location (To)";
    case "priority": return "⚡ Priority";
    case "agency": return "👷 Select Agency";
    case "agency_schedule": return "📅 Agency Date & Time";
    case "review": return "✅ Review & Submit";
    default: return key;
  }
}

export default function AddTicketModal({
  isOpen, onClose, onCreated, categories, subCategories, agencies, hierarchicalLocations,
}: AddTicketModalProps) {
  // "ticket" = normal maintenance ticket; "information" = save to Information module
  const [mode, setMode] = useState<"ticket" | "information">("ticket");
  const [infoType, setInfoType] = useState<"general" | "audit">("general");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [location, setLocation] = useState("");
  const [sourceLocation, setSourceLocation] = useState("");
  const [targetLocation, setTargetLocation] = useState("");
  const [addOrRepairChoice, setAddOrRepairChoice] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [agencyDate, setAgencyDate] = useState("");
  const [agencyTime, setAgencyTime] = useState("");
  const [additionalValues, setAdditionalValues] = useState<Record<string, string>>({});

  const [files, setFiles] = useState<File[]>([]);
  const [rule, setRule] = useState<WorkflowRule | null>(null);
  const [loadingRule, setLoadingRule] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState(0);
  // Set when the user picks a category, so we can auto-advance once its workflow rule has loaded
  const [autoAdvanceCategory, setAutoAdvanceCategory] = useState(false);

  // Reset everything when modal closes
  useEffect(() => {
    if (!isOpen) {
      setMode("ticket"); setInfoType("general");
      setDescription(""); setCategoryId(""); setSubCategoryId(""); setPriority("medium");
      setLocation(""); setSourceLocation(""); setTargetLocation(""); setAddOrRepairChoice("");
      setAgencyName(""); setAgencyDate(""); setAgencyTime(""); setAdditionalValues({});
      setFiles([]); setRule(null); setError(null); setFileNote(null); setUploading(false); setStep(0);
      setAutoAdvanceCategory(false);
    }
  }, [isOpen]);

  // Validate, then add only the acceptable files; report rejects
  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const rejected: string[] = [];
    const accepted: File[] = [];
    Array.from(incoming).forEach((f) => {
      const err = validateFile(f);
      if (err) rejected.push(err);
      else accepted.push(f);
    });
    if (accepted.length) setFiles((prev) => [...prev, ...accepted]);
    setFileNote(rejected.length ? rejected.join(" ") : null);
  };

  // Load the workflow rule whenever the category changes
  useEffect(() => {
    if (!categoryId) { setRule(null); return; }
    let cancelled = false;
    setLoadingRule(true);
    // Reset dependent fields
    setSubCategoryId(""); setLocation(""); setSourceLocation(""); setTargetLocation("");
    setAddOrRepairChoice(""); setAgencyName(""); setAgencyDate(""); setAgencyTime("");
    setAdditionalValues({});

    fetch(`/api/masters/workflow-rules?categoryId=${categoryId}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const rules = res?.data || [];
        setRule(rules.length > 0 ? rules[0] : {});
      })
      .catch(() => { if (!cancelled) setRule({}); })
      .finally(() => { if (!cancelled) setLoadingRule(false); });

    return () => { cancelled = true; };
  }, [categoryId]);

  const availableSubCategories = useMemo(
    () => subCategories.filter((s: any) => s.categoryId === categoryId),
    [subCategories, categoryId]
  );

  // Agencies linked to the selected subcategory or category, falling back to all
  const availableAgencies = useMemo(() => {
    if (!agencies.length) return [];
    if (subCategoryId) {
      const matched = agencies.filter((a: any) =>
        (a.subCategories || []).some((s: any) => (s?._id || s) === subCategoryId)
      );
      if (matched.length) return matched;
    }
    if (categoryId) {
      const matched = agencies.filter((a: any) =>
        (a.categories || []).some((c: any) => (c?._id || c) === categoryId)
      );
      if (matched.length) return matched;
    }
    return agencies;
  }, [agencies, subCategoryId, categoryId]);

  const realAgencySelected = !!agencyName && agencyName !== "__NONE__";
  const requiresAgency = !!rule?.requiresAgency;
  const showAgencyDate = requiresAgency && !!rule?.requiresAgencyDate && realAgencySelected;

  // Build the ordered list of steps based on the workflow rule (mirrors the Telegram wizard order)
  const steps = useMemo(() => {
    // Information mode: a short fixed flow that bypasses categories/workflow entirely
    if (mode === "information") {
      return ["description", "info_type", "review"];
    }
    const s: string[] = ["description", "category"];
    if (categoryId && rule) {
      if (rule.hasSubcategories) s.push("subcategory");
      if (rule.requiresAddOrRepair) s.push("add_or_repair");
      if (rule.requiresLocation) s.push("location");
      if (rule.requiresSourceLocation) s.push("source_location");
      if (rule.requiresTargetLocation) s.push("target_location");
      s.push("priority");
      if (rule.requiresAgency) {
        s.push("agency");
        if (showAgencyDate) s.push("agency_schedule");
      }
      for (const f of rule.additionalFields || []) s.push(`additional:${f.key}`);
      s.push("review");
    }
    return s;
  }, [mode, categoryId, rule, showAgencyDate]);

  // Keep the step index inside bounds when the step list changes
  useEffect(() => {
    if (step > steps.length - 1) setStep(steps.length - 1);
  }, [steps, step]);

  // Auto-advance from the Category step once its workflow rule has finished loading
  useEffect(() => {
    if (autoAdvanceCategory && !loadingRule && rule !== null && steps[step] === "category") {
      setAutoAdvanceCategory(false);
      setError(null);
      setStep((s) => Math.min(s + 1, steps.length - 1));
    }
  }, [autoAdvanceCategory, loadingRule, rule, steps, step]);

  if (!isOpen) return null;

  const currentKey = steps[step] || "description";

  // Validate the current step; returns an error string or null
  const validateStep = (key: string): string | null => {
    if (key.startsWith("additional:")) {
      const fk = key.split(":")[1];
      if (!additionalValues[fk]?.toString().trim()) {
        const lbl = rule?.additionalFields?.find((f) => f.key === fk)?.label || "this field";
        return `Please fill in "${lbl}".`;
      }
      return null;
    }
    switch (key) {
      case "description":
        if (!description.trim()) return "Please enter a description.";
        return null;
      case "category":
        if (!categoryId) return "Please select a category.";
        if (loadingRule) return "Loading workflow, please wait…";
        return null;
      case "subcategory":
        if (availableSubCategories.length > 0 && !subCategoryId) return "Please select a subcategory.";
        return null;
      case "add_or_repair":
        if (!addOrRepairChoice) return "Please choose Add New or Repair.";
        return null;
      case "location":
        if (!location) return "Please select a location.";
        return null;
      case "source_location":
        if (!sourceLocation) return "Please select a source location.";
        return null;
      case "target_location":
        if (!targetLocation) return "Please select a target location.";
        return null;
      case "agency":
        if (!agencyName) return "Please select an agency (or No Agency).";
        return null;
      default:
        return null;
    }
  };

  const goNext = () => {
    const err = validateStep(currentKey);
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const goPrev = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  // Advance immediately after a valid single-choice selection (Telegram-style auto-advance).
  // Steps only ever insert *after* the current position, so incrementing by 1 is always correct.
  const goForward = () => {
    setError(null);
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      // ----- Information mode: save to the Information module, not as a ticket -----
      if (mode === "information") {
        const res = await fetch("/api/informations/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: description, type: infoType }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "Failed to save information");

        const infoId = data.data?._id;
        if (infoId && files.length > 0) {
          setUploading(true);
          const fd = new FormData();
          fd.append("informationId", infoId);
          files.forEach((f) => fd.append("files", f));
          const upRes = await fetch("/api/informations/upload-media", { method: "POST", body: fd });
          const upData = await upRes.json().catch(() => ({}));
          setUploading(false);
          if (!upRes.ok || !upData.ok) {
            onCreated();
            setError(
              `Information saved, but attachments failed: ${
                upData.error || "upload error"
              }`
            );
            return;
          }
        }

        onCreated();
        onClose();
        return;
      }

      const payload: any = {
        description,
        categoryId,
        subCategoryId: subCategoryId || null,
        priority,
        location: rule?.requiresLocation ? location : null,
        sourceLocation: rule?.requiresSourceLocation ? sourceLocation : null,
        targetLocation: rule?.requiresTargetLocation ? targetLocation : null,
        addOrRepairChoice: rule?.requiresAddOrRepair ? addOrRepairChoice : null,
        agencyRequired: requiresAgency,
        agencyName: requiresAgency ? agencyName : null,
        agencyDate: showAgencyDate && agencyDate ? agencyDate : null,
        agencyTime: showAgencyDate && agencyTime ? agencyTime : null,
        additionalFields: additionalValues,
      };

      const res = await fetch("/api/tickets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to create ticket");

      // The "Information" category is stored as an Information entry, not a ticket —
      // there's no ticket to attach media to, so just finish.
      if (data.kind === "information") {
        onCreated();
        onClose();
        return;
      }

      const newTicketId = data.data.ticketId;

      if (files.length > 0) {
        setUploading(true);
        const fd = new FormData();
        fd.append("ticketId", newTicketId);
        fd.append("mediaField", "photos"); // server routes each file by type
        fd.append("uploadedBy", "Dashboard Admin");
        files.forEach((f) => fd.append("files", f));

        const upRes = await fetch("/api/tickets/upload-media", { method: "POST", body: fd });
        const upData = await upRes.json().catch(() => ({}));
        setUploading(false);

        if (!upRes.ok || !upData.ok) {
          // Ticket exists, but attachments failed — keep the modal open and tell the user
          const reason = upData.error || (upData.details && upData.details.join(" ")) || "Attachment upload failed.";
          onCreated(); // refresh so the new ticket shows up
          setError(`Ticket ${newTicketId} was created, but attachments failed: ${reason} You can add them later by editing the ticket.`);
          return;
        }
        if (upData.data?.errors?.length) {
          // Some files uploaded, some failed
          onCreated();
          setError(`Ticket ${newTicketId} created. Some files failed: ${upData.data.errors.join(" ")}`);
          return;
        }
      }

      onCreated();
      onClose();
    } catch (e: any) {
      setUploading(false);
      setError(e.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const catName = categories.find((c: any) => c._id === categoryId)?.displayName
    || categories.find((c: any) => c._id === categoryId)?.name || "";
  const subName = availableSubCategories.find((s: any) => s._id === subCategoryId)?.name || "";

  const totalSteps = steps.length;
  const progressPct = Math.round(((step + 1) / totalSteps) * 100);

  // ----- Step body -----
  const renderStep = () => {
    if (currentKey.startsWith("additional:")) {
      const fk = currentKey.split(":")[1];
      const f = rule?.additionalFields?.find((x) => x.key === fk);
      if (!f) return null;
      return (
        <div>
          <p className="text-sm text-gray-500 mb-3">Enter {f.label.toLowerCase()}.</p>
          {f.type === "select" ? (
            <select
              autoFocus
              value={additionalValues[fk] || ""}
              onChange={(e) => { setAdditionalValues((p) => ({ ...p, [fk]: e.target.value })); if (e.target.value) goForward(); }}
              className="w-full px-4 py-3 bg-indigo-50 border-2 border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium"
            >
              <option value="">Select {f.label}…</option>
              {(f.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ) : (
            <input
              autoFocus
              type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
              value={additionalValues[fk] || ""}
              onChange={(e) => setAdditionalValues((p) => ({ ...p, [fk]: e.target.value }))}
              className="w-full px-4 py-3 bg-indigo-50 border-2 border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-medium"
            />
          )}
        </div>
      );
    }

    switch (currentKey) {
      case "description":
        return (
          <div className="space-y-5">
            <div>
              <p className="text-sm text-gray-500 mb-3">
                {mode === "information" ? "Enter the information to save." : "Describe the issue."}
              </p>
              <textarea
                autoFocus
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder={mode === "information" ? "Type the information…" : "Describe the issue…"}
                className="w-full px-4 py-3 bg-orange-50 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all resize-none"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-green-600" /> Attachments ({files.length})
                </span>
                <label className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg cursor-pointer text-xs font-medium flex items-center gap-1.5 transition-colors">
                  <Plus size={14} /> Add Files
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept={FILE_ACCEPT}
                    onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                  />
                </label>
              </div>
              {fileNote && (
                <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
                  {fileNote}
                </div>
              )}
              {files.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  No files added. Allowed: JPG, PNG, MP4, MOV, PDF, Office docs.
                </p>
              ) : (
                <div className="space-y-2">
                  {files.map((f, idx) => {
                    const isImg = f.type.startsWith("image/");
                    const isVid = f.type.startsWith("video/");
                    return (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {isImg ? <Camera size={14} className="text-gray-400 shrink-0" /> : isVid ? <Video size={14} className="text-gray-400 shrink-0" /> : <FileText size={14} className="text-gray-400 shrink-0" />}
                          <span className="truncate text-gray-700">{f.name}</span>
                        </div>
                        <button onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 p-1 shrink-0">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );

      case "info_type":
        return (
          <div>
            <p className="text-sm text-gray-500 mb-3">Classify this information entry.</p>
            <div className="flex gap-3">
              {[{ v: "general", l: "📌 General" }, { v: "audit", l: "🛡️ Audit" }].map((o) => (
                <button
                  key={o.v}
                  onClick={() => { setInfoType(o.v as "general" | "audit"); goForward(); }}
                  className={`px-5 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                    infoType === o.v ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        );

      case "category":
        return (
          <div>
            <p className="text-sm text-gray-500 mb-3">Select the category for this ticket.</p>
            <select
              autoFocus
              value={categoryId}
              onChange={(e) => {
                const v = e.target.value;
                setCategoryId(v);
                setAutoAdvanceCategory(!!v); // advance once the workflow rule loads
              }}
              className="w-full px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
            >
              <option value="">Select Category…</option>
              {categories.map((cat: any) => (
                <option key={cat._id} value={cat._id}>{cat.displayName || cat.name}</option>
              ))}
            </select>
            {loadingRule && (
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-blue-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading workflow…
              </div>
            )}
          </div>
        );

      case "subcategory":
        return (
          <div>
            <p className="text-sm text-gray-500 mb-3">Select a subcategory.</p>
            <select
              autoFocus
              value={subCategoryId}
              onChange={(e) => { setSubCategoryId(e.target.value); if (e.target.value) goForward(); }}
              disabled={availableSubCategories.length === 0}
              className="w-full px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium disabled:opacity-50"
            >
              <option value="">Select Subcategory…</option>
              {availableSubCategories.map((sub: any) => (
                <option key={sub._id} value={sub._id}>{sub.name}</option>
              ))}
            </select>
            {availableSubCategories.length === 0 && (
              <p className="mt-2 text-xs text-gray-400 italic">No subcategories configured — you can continue.</p>
            )}
          </div>
        );

      case "add_or_repair":
        return (
          <div>
            <p className="text-sm text-gray-500 mb-3">Is this a new addition or a repair?</p>
            <div className="flex gap-3">
              {[{ v: "add", l: "➕ Add New" }, { v: "repair", l: "🔧 Repair" }].map((o) => (
                <button
                  key={o.v}
                  onClick={() => { setAddOrRepairChoice(o.v); goForward(); }}
                  className={`px-5 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                    addOrRepairChoice === o.v ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        );

      case "location":
        return (
          <div>
            <p className="text-sm text-gray-500 mb-3">Where is the issue located?</p>
            <LocationSelect value={location} onChange={(v) => { setLocation(v); if (v) goForward(); }} locations={hierarchicalLocations} />
          </div>
        );

      case "source_location":
        return (
          <div>
            <p className="text-sm text-gray-500 mb-3">Select the source location (from).</p>
            <LocationSelect value={sourceLocation} onChange={(v) => { setSourceLocation(v); if (v) goForward(); }} locations={hierarchicalLocations} />
          </div>
        );

      case "target_location":
        return (
          <div>
            <p className="text-sm text-gray-500 mb-3">Select the target location (to).</p>
            <LocationSelect value={targetLocation} onChange={(v) => { setTargetLocation(v); if (v) goForward(); }} locations={hierarchicalLocations} />
          </div>
        );

      case "priority":
        return (
          <div>
            <p className="text-sm text-gray-500 mb-3">Set the priority.</p>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => { setPriority(p.value); goForward(); }}
                  className={`px-5 py-3 rounded-xl text-sm font-medium border-2 transition-all ${priority === p.value ? p.active : p.bg}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        );

      case "agency":
        return (
          <div>
            <p className="text-sm text-gray-500 mb-3">Select the agency, or choose No Agency.</p>
            <select
              autoFocus
              value={agencyName}
              onChange={(e) => { setAgencyName(e.target.value); setAgencyDate(""); setAgencyTime(""); if (e.target.value) goForward(); }}
              className="w-full px-4 py-3 bg-amber-50 border-2 border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-medium"
            >
              <option value="">Select Agency…</option>
              {availableAgencies.map((a: any) => (
                <option key={a._id} value={a.name}>👷 {a.name}</option>
              ))}
              <option value="__NONE__">❌ No Agency</option>
            </select>
          </div>
        );

      case "agency_schedule":
        return (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Agency Date <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="date"
                value={agencyDate}
                onChange={(e) => setAgencyDate(e.target.value)}
                className="w-full px-4 py-3 bg-amber-50 border-2 border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-medium"
              />
            </div>
            <div className={!agencyDate ? "opacity-50" : ""}>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Time Slot</label>
              <select
                value={agencyTime}
                onChange={(e) => setAgencyTime(e.target.value)}
                disabled={!agencyDate}
                className="w-full px-4 py-3 bg-amber-50 border-2 border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all font-medium disabled:cursor-not-allowed"
              >
                <option value="">Select Time Slot…</option>
                <option value="First Half">🌅 First Half</option>
                <option value="Second Half">🌆 Second Half</option>
              </select>
              {!agencyDate && <p className="text-[10px] text-gray-400 mt-1 italic">Select a date first to choose a time slot.</p>}
            </div>
          </div>
        );

      case "review": {
        if (mode === "information") {
          const infoRows: [string, string][] = [
            ["Content", description || "—"],
            ["Type", infoType === "audit" ? "Audit" : "General"],
            ["Attachments", files.length ? `${files.length} file(s)` : "None"],
          ];
          return (
            <div>
              <p className="text-sm text-gray-500 mb-4">This will be saved to the Information section (not as a ticket).</p>
              <div className="rounded-xl border-2 border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {infoRows.map(([k, v]) => (
                  <div key={k} className="flex items-start gap-3 px-4 py-2.5 bg-white">
                    <span className="text-xs font-bold uppercase tracking-wide text-gray-400 w-28 shrink-0">{k}</span>
                    <span className="text-sm text-gray-800 font-medium break-words">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        const rows: [string, string][] = [
          ["Description", description || "—"],
          ["Category", catName],
        ];
        if (rule?.hasSubcategories) rows.push(["Subcategory", subName || "—"]);
        if (rule?.requiresAddOrRepair) rows.push(["Add/Repair", addOrRepairChoice === "add" ? "Add New" : addOrRepairChoice === "repair" ? "Repair" : "—"]);
        if (rule?.requiresLocation) rows.push(["Location", location || "—"]);
        if (rule?.requiresSourceLocation) rows.push(["Source", sourceLocation || "—"]);
        if (rule?.requiresTargetLocation) rows.push(["Target", targetLocation || "—"]);
        rows.push(["Priority", priority]);
        if (requiresAgency) rows.push(["Agency", agencyName === "__NONE__" ? "No Agency" : agencyName || "—"]);
        if (showAgencyDate && agencyDate) rows.push(["Agency Date", `${agencyDate}${agencyTime ? ` · ${agencyTime}` : ""}`]);
        for (const f of rule?.additionalFields || []) rows.push([f.label, additionalValues[f.key] || "—"]);
        rows.push(["Attachments", files.length ? `${files.length} file(s)` : "None"]);
        return (
          <div>
            <p className="text-sm text-gray-500 mb-4">Review the details before creating the ticket.</p>
            <div className="rounded-xl border-2 border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-start gap-3 px-4 py-2.5 bg-white">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-400 w-28 shrink-0">{k}</span>
                  <span className="text-sm text-gray-800 font-medium break-words">{v}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const isReview = currentKey === "review";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl max-h-[95vh] flex flex-col bg-gradient-to-br from-blue-50 via-white to-purple-50 rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white/95 backdrop-blur-sm border-b-2 border-gray-200 px-6 sm:px-8 py-5 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl shadow-lg">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {mode === "information" ? "New Information" : "New Ticket"}
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                  Step {step + 1} of {totalSteps} · {stepTitle(currentKey, rule)}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>
          {/* Progress bar */}
          <div className="mt-4 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Body — only the current step */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {/* Mode selector — choose Ticket vs Information up front */}
          {step === 0 && (
            <div className="mb-5 grid grid-cols-2 gap-3">
              {[
                { v: "ticket", l: "Maintenance Ticket", icon: <Wrench className="w-4 h-4" />, desc: "Track work to be done" },
                { v: "information", l: "Information", icon: <Info className="w-4 h-4" />, desc: "Save a note to Information" },
              ].map((o) => {
                const activeMode = mode === o.v;
                return (
                  <button
                    key={o.v}
                    onClick={() => { if (mode !== o.v) { setMode(o.v as "ticket" | "information"); setError(null); setStep(0); } }}
                    className={`text-left px-4 py-3 rounded-xl border-2 transition-all ${
                      activeMode ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm">{o.icon}{o.l}</div>
                    <div className={`text-[11px] mt-0.5 ${activeMode ? "text-blue-100" : "text-gray-400"}`}>{o.desc}</div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-md border-2 border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{stepTitle(currentKey, rule)}</h3>
            {renderStep()}
          </div>
          {error && (
            <div className="mt-4 px-4 py-3 bg-red-50 border-2 border-red-200 rounded-xl text-sm text-red-700 font-medium">
              {error}
            </div>
          )}
        </div>

        {/* Footer — Previous / Next / Create */}
        <div className="bg-white/95 backdrop-blur-sm border-t-2 border-gray-200 px-6 sm:px-8 py-5 rounded-b-3xl">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={goPrev}
              disabled={step === 0 || submitting}
              className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" /> Previous
            </button>

            {isReview ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {uploading ? "Uploading…" : submitting ? "Saving…" : mode === "information" ? "Save Information" : "Create Ticket"}
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={submitting || (currentKey === "category" && loadingRule)}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 disabled:opacity-60"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
