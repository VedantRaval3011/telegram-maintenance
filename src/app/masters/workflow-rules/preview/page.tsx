"use client";

import { useState } from "react";
import { MessageSquare, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface IWorkflowRule {
  categoryId: string;
  categoryName: string;
  hasSubcategories: boolean;
  requiresLocation: boolean;
  requiresSourceLocation: boolean;
  requiresTargetLocation: boolean;
  requiresAgency: boolean;
  agencyType: "boolean" | "name";
  agencyList: string[];
  requiresAgencyDate: boolean;
  additionalFields: {
    key: string;
    label: string;
    type: "text" | "number" | "date" | "photo" | "select";
    options?: string[];
  }[];
}

export default function TelegramPreviewPage() {
  const [currentStep, setCurrentStep] = useState<"initial" | "category" | "filled">("initial");
  
  // Sample rule for demonstration
  const [sampleRule, setSampleRule] = useState<IWorkflowRule>({
    categoryId: "paint_id",
    categoryName: "Paint",
    hasSubcategories: false,
    requiresLocation: true,
    requiresSourceLocation: false,
    requiresTargetLocation: false,
    requiresAgency: true,
    agencyType: "name",
    agencyList: ["ABC Painters", "XYZ Contractors", "PQR Services"],
    requiresAgencyDate: true,
    additionalFields: [
      { key: "paintType", label: "Paint Type", type: "select", options: ["Epoxy", "Enamel", "Oil-based"] },
      { key: "surfaceArea", label: "Surface Area (sq ft)", type: "number" }
    ]
  });

  // Generate preview data based on rule
  const getPreviewData = () => {
    const data: any = {
      issue: "Sample issue description",
      category: currentStep !== "initial" ? sampleRule.categoryName : "—",
      subcategory: "—",
      priority: "—",
      location: "—",
      sourceLocation: "—",
      targetLocation: "—",
      agency: "—",
      photos: "None"
    };

    if (currentStep === "filled") {
      data.category = sampleRule.categoryName + " ✅";
      data.priority = "HIGH ✅";
      
      if (sampleRule.hasSubcategories) {
        data.subcategory = "Sample Subcategory ✅";
      }
      
      if (sampleRule.requiresLocation) {
        data.location = "Building A > Floor 2 > Room 101 ✅";
      }
      
      if (sampleRule.requiresSourceLocation) {
        data.sourceLocation = "Building A > Floor 1 ✅";
      }
      
      if (sampleRule.requiresTargetLocation) {
        data.targetLocation = "Building B > Floor 2 ✅";
      }
      
      if (sampleRule.requiresAgency) {
        if (sampleRule.agencyType === "boolean") {
          data.agency = "Yes ✅";
        } else {
          const agencyName = sampleRule.agencyList[0] || "Sample Agency";
          if (sampleRule.requiresAgencyDate) {
            data.agency = `${agencyName} (Date: 2025-12-15) ✅`;
          } else {
            data.agency = `${agencyName} ✅`;
          }
        }
      }
      
      if (sampleRule.additionalFields.length > 0) {
        data.additionalFields = sampleRule.additionalFields.map(f => ({
          label: f.label,
          value: f.type === "select" ? (f.options?.[0] || "Option 1") : "Sample Value"
        }));
      }
    }

    return data;
  };

  const data = getPreviewData();

  // Generate buttons based on current step and rule
  const getButtons = () => {
    const buttons: string[] = [];
    
    if (currentStep === "initial") {
      buttons.push("📂 Select Category");
      buttons.push("⚡ Select Priority");
      if (sampleRule.requiresLocation) buttons.push("📍 Select Location");
      if (sampleRule.requiresSourceLocation) buttons.push("📍 Select From (Source)");
      if (sampleRule.requiresTargetLocation) buttons.push("📍 Select To (Target)");
      if (sampleRule.requiresAgency) buttons.push("🧾 Select Agency");
      if (sampleRule.additionalFields.length > 0) buttons.push("📝 Additional Details");
    } else if (currentStep === "category") {
      buttons.push("📂 Change Category");
      if (sampleRule.hasSubcategories) buttons.push("🧩 Select Subcategory");
      buttons.push("⚡ Select Priority");
      if (sampleRule.requiresLocation) buttons.push("📍 Select Location");
      if (sampleRule.requiresSourceLocation) buttons.push("📍 Select From (Source)");
      if (sampleRule.requiresTargetLocation) buttons.push("📍 Select To (Target)");
      if (sampleRule.requiresAgency) buttons.push("🧾 Select Agency");
      if (sampleRule.additionalFields.length > 0) buttons.push("📝 Additional Details");
    } else if (currentStep === "filled") {
      buttons.push("📂 Change Category");
      if (sampleRule.hasSubcategories) buttons.push("🧩 Change Subcategory");
      buttons.push("⚡ Change Priority");
      if (sampleRule.requiresLocation) buttons.push("📍 Change Location");
      if (sampleRule.requiresSourceLocation) buttons.push("📍 Change From");
      if (sampleRule.requiresTargetLocation) buttons.push("📍 Change To");
      if (sampleRule.requiresAgency) buttons.push("🧾 Change Agency");
      if (sampleRule.additionalFields.length > 0) buttons.push("📝 Change Details");
      buttons.push("✅ Create Ticket");
    }

    return buttons;
  };

  const buttons = getButtons();

  return (
    <div className="min-h-screen bg-[#ecfdf5] font-sans pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/masters/workflow-rules" className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Workflow Rules
          </Link>
          <h1 className="text-3xl font-bold text-emerald-950">Telegram Message Preview</h1>
          <p className="text-emerald-700/80 mt-1">See how your workflow configuration will look in Telegram</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Configuration Panel */}
          <div className="space-y-6">
            <div className="bg-white/60 backdrop-blur-md border border-emerald-100 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-emerald-950 mb-4">Configure Preview</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-emerald-900 mb-2">Category Name</label>
                  <input
                    type="text"
                    value={sampleRule.categoryName}
                    onChange={(e) => setSampleRule({ ...sampleRule, categoryName: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-emerald-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={sampleRule.hasSubcategories}
                      onChange={(e) => setSampleRule({ ...sampleRule, hasSubcategories: e.target.checked })}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <span className="text-sm">Has Subcategories</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-emerald-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={sampleRule.requiresLocation}
                      onChange={(e) => setSampleRule({ ...sampleRule, requiresLocation: e.target.checked })}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <span className="text-sm">Requires Location</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-emerald-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={sampleRule.requiresSourceLocation}
                      onChange={(e) => setSampleRule({ ...sampleRule, requiresSourceLocation: e.target.checked })}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <span className="text-sm">Source Location</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-emerald-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={sampleRule.requiresTargetLocation}
                      onChange={(e) => setSampleRule({ ...sampleRule, requiresTargetLocation: e.target.checked })}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <span className="text-sm">Target Location</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-emerald-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={sampleRule.requiresAgency}
                      onChange={(e) => setSampleRule({ ...sampleRule, requiresAgency: e.target.checked })}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <span className="text-sm">Requires Agency</span>
                  </label>

                  {sampleRule.requiresAgency && (
                    <label className="flex items-center gap-2 p-3 border rounded-xl cursor-pointer hover:bg-emerald-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={sampleRule.requiresAgencyDate}
                        onChange={(e) => setSampleRule({ ...sampleRule, requiresAgencyDate: e.target.checked })}
                        className="w-4 h-4 text-emerald-600"
                      />
                      <span className="text-sm">Agency Date</span>
                    </label>
                  )}
                </div>

                {sampleRule.requiresAgency && (
                  <div>
                    <label className="block text-sm font-medium text-emerald-900 mb-2">Agency Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setSampleRule({ ...sampleRule, agencyType: "boolean" })}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          sampleRule.agencyType === "boolean"
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        Yes/No
                      </button>
                      <button
                        onClick={() => setSampleRule({ ...sampleRule, agencyType: "name" })}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          sampleRule.agencyType === "name"
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        Select Agency
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Telegram Preview */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#0088cc]" />
                  <h3 className="font-semibold text-slate-900">Telegram Preview</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentStep("initial")}
                    className={`px-3 py-1 text-xs rounded-lg transition-all ${
                      currentStep === "initial" 
                        ? "bg-[#0088cc] text-white" 
                        : "bg-white text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Initial
                  </button>
                  <button
                    onClick={() => setCurrentStep("category")}
                    className={`px-3 py-1 text-xs rounded-lg transition-all ${
                      currentStep === "category" 
                        ? "bg-[#0088cc] text-white" 
                        : "bg-white text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Category
                  </button>
                  <button
                    onClick={() => setCurrentStep("filled")}
                    className={`px-3 py-1 text-xs rounded-lg transition-all ${
                      currentStep === "filled" 
                        ? "bg-[#0088cc] text-white" 
                        : "bg-white text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Filled
                  </button>
                </div>
              </div>

              {/* Telegram Message Mockup */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
                {/* Telegram Header */}
                <div className="bg-[#0088cc] text-white px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg">
                    🤖
                  </div>
                  <div>
                    <div className="font-semibold">Maintenance Bot</div>
                    <div className="text-xs text-white/80">online</div>
                  </div>
                </div>

                {/* Message Bubble */}
                <div className="p-4 bg-[#e5ddd5]">
                  <div className="bg-white rounded-2xl rounded-tl-none shadow-sm p-4">
                    <div className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      🛠 Ticket Wizard
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <span className="text-slate-500">📝</span>
                        <span className="text-slate-700">Issue: {data.issue}</span>
                      </div>
                      
                      <div className="border-t border-slate-100 my-3"></div>
                      
                      <div className="space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Category:</span>
                          <span className={`font-medium ${data.category.includes("✅") ? "text-emerald-600" : "text-slate-400"}`}>
                            {data.category}
                          </span>
                        </div>
                        
                        {sampleRule.hasSubcategories && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">Subcategory:</span>
                            <span className={`font-medium ${data.subcategory.includes("✅") ? "text-emerald-600" : "text-slate-400"}`}>
                              {data.subcategory}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex justify-between">
                          <span className="text-slate-600">Priority:</span>
                          <span className={`font-medium ${data.priority.includes("✅") ? "text-emerald-600" : "text-slate-400"}`}>
                            {data.priority}
                          </span>
                        </div>
                        
                        {sampleRule.requiresLocation && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">Location:</span>
                            <span className={`font-medium ${data.location.includes("✅") ? "text-emerald-600" : "text-slate-400"}`}>
                              {data.location}
                            </span>
                          </div>
                        )}
                        
                        {sampleRule.requiresSourceLocation && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">From:</span>
                            <span className={`font-medium ${data.sourceLocation.includes("✅") ? "text-emerald-600" : "text-slate-400"}`}>
                              {data.sourceLocation}
                            </span>
                          </div>
                        )}
                        
                        {sampleRule.requiresTargetLocation && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">To:</span>
                            <span className={`font-medium ${data.targetLocation.includes("✅") ? "text-emerald-600" : "text-slate-400"}`}>
                              {data.targetLocation}
                            </span>
                          </div>
                        )}
                        
                        {sampleRule.requiresAgency && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">Agency:</span>
                            <span className={`font-medium ${data.agency.includes("✅") ? "text-emerald-600" : "text-slate-400"}`}>
                              {data.agency}
                            </span>
                          </div>
                        )}
                        
                        {data.additionalFields && data.additionalFields.map((field: any, idx: number) => (
                          <div key={idx} className="flex justify-between">
                            <span className="text-slate-600">{field.label}:</span>
                            <span className="font-medium text-emerald-600">{field.value} ✅</span>
                          </div>
                        ))}
                        
                        <div className="flex justify-between">
                          <span className="text-slate-600">📸 Photos:</span>
                          <span className="text-slate-400">{data.photos}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Inline Keyboard */}
                  {buttons.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {buttons.map((btn, idx) => (
                        <button
                          key={idx}
                          className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                            btn.includes("Create Ticket")
                              ? "bg-emerald-500 text-white shadow-md hover:bg-emerald-600"
                              : "bg-white text-[#0088cc] hover:bg-slate-50 shadow-sm"
                          }`}
                        >
                          {btn}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Agency Selection Preview */}
              {currentStep === "category" && sampleRule.requiresAgency && sampleRule.agencyType === "name" && sampleRule.agencyList.length > 0 && (
                <div className="mt-4 bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
                  <div className="bg-[#0088cc] text-white px-4 py-2 text-sm font-medium">
                    When user clicks "Select Agency":
                  </div>
                  <div className="p-4 bg-[#e5ddd5]">
                    <div className="bg-white rounded-2xl rounded-tl-none shadow-sm p-4">
                      <div className="font-semibold text-slate-900 mb-3">🧾 Select Agency:</div>
                      <div className="space-y-1">
                        {sampleRule.agencyList.map((agency, idx) => (
                          <button
                            key={idx}
                            className="w-full py-2.5 px-4 bg-white text-[#0088cc] rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm transition-all"
                          >
                            👷 {agency}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
