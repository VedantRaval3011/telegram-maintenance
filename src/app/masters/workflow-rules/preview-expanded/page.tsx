"use client";

import { useState } from "react";
import { MessageSquare, ArrowLeft, ChevronDown } from "lucide-react";
import Link from "next/link";

type ActiveSection = "category" | "priority" | "subcategory" | "location" | "agency" | "complete" | null;

export default function ExpandedWizardPreview() {
  const [activeSection, setActiveSection] = useState<ActiveSection>("category");
  const [selectedValues, setSelectedValues] = useState({
    category: null as string | null,
    subcategory: null as string | null,
    priority: null as string | null,
    location: null as string | null,
    agency: null as string | null,
  });

  // Sample data
  const categories = ["⚡ Electrical", "🔧 Plumbing", "🎨 Paint", "🏗️ Civil", "❄️ HVAC", "🪑 Carpentry"];
  const subcategories = ["💨 Fan", "💡 Light", "🔌 Socket", "🔧 Switch", "⚡ MCB/DB"];
  const priorities = ["🔴 HIGH", "🟡 MEDIUM", "🟢 LOW"];
  const agencies = ["👷 ABC Painters", "👷 XYZ Contractors", "👷 PQR Services", "👷 LMN Builders"];
  const locations = ["🏢 Building A > Floor 1", "🏢 Building A > Floor 2", "🏢 Building B > Floor 1", "🏢 Building B > Floor 2"];

  const handleSelect = (section: keyof typeof selectedValues, value: string) => {
    setSelectedValues({ ...selectedValues, [section]: value });
    
    // Auto-advance to next section
    if (section === "category") setActiveSection("priority");
    else if (section === "priority") setActiveSection("subcategory");
    else if (section === "subcategory") setActiveSection("location");
    else if (section === "location") setActiveSection("agency");
    else if (section === "agency") setActiveSection("complete");
  };

  const getCompletedFields = () => {
    const completed = [];
    if (selectedValues.category) completed.push({ label: "Category", value: selectedValues.category });
    if (selectedValues.priority) completed.push({ label: "Priority", value: selectedValues.priority });
    if (selectedValues.subcategory) completed.push({ label: "Subcategory", value: selectedValues.subcategory });
    if (selectedValues.location) completed.push({ label: "Location", value: selectedValues.location });
    if (selectedValues.agency) completed.push({ label: "Agency", value: selectedValues.agency });
    return completed;
  };

  const getRemainingFields = () => {
    const remaining = [];
    if (!selectedValues.category) remaining.push("Category");
    if (!selectedValues.priority) remaining.push("Priority");
    if (!selectedValues.subcategory) remaining.push("Subcategory");
    if (!selectedValues.location) remaining.push("Location");
    if (!selectedValues.agency) remaining.push("Agency");
    return remaining;
  };

  const completedFields = getCompletedFields();
  const remainingFields = getRemainingFields();

  return (
    <div className="min-h-screen bg-[#ecfdf5] font-sans pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/masters/workflow-rules" className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Workflow Rules
          </Link>
          <h1 className="text-3xl font-bold text-emerald-950">Expanded Wizard Preview</h1>
          <p className="text-emerald-700/80 mt-1">All fields and options visible at once - no popups or dropdowns</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Controls */}
          <div className="space-y-4">
            <div className="bg-white/60 backdrop-blur-md border border-emerald-100 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-emerald-950 mb-4">Simulation Controls</h2>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setActiveSection("category");
                    setSelectedValues({ category: null, subcategory: null, priority: null, location: null, agency: null });
                  }}
                  className="w-full p-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-left transition-colors"
                >
                  🔄 Reset to Initial State
                </button>

                <div className="border-t pt-3">
                  <p className="text-sm font-medium text-slate-700 mb-2">Jump to Section:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {["category", "priority", "subcategory", "location", "agency", "complete"].map((section) => (
                      <button
                        key={section}
                        onClick={() => setActiveSection(section as ActiveSection)}
                        className={`p-2 rounded-lg text-sm transition-all ${
                          activeSection === section
                            ? "bg-emerald-500 text-white"
                            : "bg-white border border-slate-200 hover:border-emerald-300"
                        }`}
                      >
                        {section.charAt(0).toUpperCase() + section.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-3">
                  <p className="text-sm font-medium text-slate-700 mb-2">Quick Select:</p>
                  <div className="space-y-2 text-sm">
                    <button
                      onClick={() => handleSelect("category", categories[0])}
                      className="w-full p-2 bg-white border rounded-lg hover:bg-emerald-50 text-left"
                    >
                      Select Category: {categories[0]}
                    </button>
                    <button
                      onClick={() => handleSelect("priority", priorities[0])}
                      className="w-full p-2 bg-white border rounded-lg hover:bg-emerald-50 text-left"
                    >
                      Select Priority: {priorities[0]}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-md border border-emerald-100 rounded-2xl p-6">
              <h3 className="font-bold text-emerald-950 mb-3">Design Notes</h3>
              <ul className="text-sm text-slate-700 space-y-2">
                <li>✅ All options visible at once</li>
                <li>✅ No popups or hidden menus</li>
                <li>✅ Completed fields shown at top</li>
                <li>✅ Current section expanded with options</li>
                <li>✅ Quick navigation buttons</li>
                <li>✅ Auto-advance to next section</li>
              </ul>
            </div>
          </div>

          {/* Right: Telegram Preview */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#0088cc]" />
                  <h3 className="font-semibold text-slate-900">Telegram - Expanded View</h3>
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
                <div className="p-4 bg-[#e5ddd5] max-h-[600px] overflow-y-auto">
                  <div className="bg-white rounded-2xl rounded-tl-none shadow-sm p-4">
                    <div className="font-semibold text-slate-900 mb-3">
                      🛠 Ticket Wizard
                    </div>
                    
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start gap-2">
                        <span className="text-slate-500">📝</span>
                        <span className="text-slate-700">Issue: Fan not working in room 201</span>
                      </div>
                      
                      {/* Completed Fields Section */}
                      {completedFields.length > 0 && (
                        <>
                          <div className="border-t border-slate-200 my-3"></div>
                          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                            ✅ Completed Fields
                          </div>
                          <div className="space-y-1.5">
                            {completedFields.map((field, idx) => (
                              <div key={idx} className="flex justify-between items-center">
                                <span className="text-slate-600">{field.label}:</span>
                                <span className="font-medium text-emerald-600">{field.value} ✅</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Active Section with Options */}
                      {activeSection && activeSection !== "complete" && (
                        <>
                          <div className="border-t border-slate-200 my-3"></div>
                          <div className="text-xs font-bold text-[#0088cc] uppercase tracking-wide flex items-center gap-1">
                            <ChevronDown className="w-3 h-3" />
                            {activeSection.toUpperCase()} (Select One)
                          </div>
                          <div className="space-y-1 mt-2">
                            {activeSection === "category" && categories.map((cat, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSelect("category", cat)}
                                className="w-full py-2.5 px-4 bg-white text-[#0088cc] rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm transition-all border border-slate-100"
                              >
                                {cat}
                              </button>
                            ))}
                            {activeSection === "priority" && priorities.map((pri, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSelect("priority", pri)}
                                className="w-full py-2.5 px-4 bg-white text-[#0088cc] rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm transition-all border border-slate-100"
                              >
                                {pri}
                              </button>
                            ))}
                            {activeSection === "subcategory" && subcategories.map((sub, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSelect("subcategory", sub)}
                                className="w-full py-2.5 px-4 bg-white text-[#0088cc] rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm transition-all border border-slate-100"
                              >
                                {sub}
                              </button>
                            ))}
                            {activeSection === "location" && locations.map((loc, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSelect("location", loc)}
                                className="w-full py-2.5 px-4 bg-white text-[#0088cc] rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm transition-all border border-slate-100"
                              >
                                {loc}
                              </button>
                            ))}
                            {activeSection === "agency" && agencies.map((agency, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSelect("agency", agency)}
                                className="w-full py-2.5 px-4 bg-white text-[#0088cc] rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm transition-all border border-slate-100"
                              >
                                {agency}
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Remaining Fields */}
                      {remainingFields.length > 0 && activeSection !== "complete" && (
                        <>
                          <div className="border-t border-slate-200 my-3"></div>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                            📋 Remaining Fields
                          </div>
                          <div className="text-xs text-slate-500">
                            {remainingFields.join(", ")}
                          </div>
                        </>
                      )}

                      {/* Navigation Buttons */}
                      <div className="border-t border-slate-200 my-3"></div>
                      <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                        Quick Jump
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => setActiveSection("category")}
                          className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                            activeSection === "category"
                              ? "bg-[#0088cc] text-white"
                              : "bg-white text-[#0088cc] border border-slate-100"
                          }`}
                        >
                          📂 Category
                        </button>
                        <button
                          onClick={() => setActiveSection("priority")}
                          className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                            activeSection === "priority"
                              ? "bg-[#0088cc] text-white"
                              : "bg-white text-[#0088cc] border border-slate-100"
                          }`}
                        >
                          ⚡ Priority
                        </button>
                        <button
                          onClick={() => setActiveSection("subcategory")}
                          className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                            activeSection === "subcategory"
                              ? "bg-[#0088cc] text-white"
                              : "bg-white text-[#0088cc] border border-slate-100"
                          }`}
                        >
                          🧩 Subcategory
                        </button>
                        <button
                          onClick={() => setActiveSection("location")}
                          className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                            activeSection === "location"
                              ? "bg-[#0088cc] text-white"
                              : "bg-white text-[#0088cc] border border-slate-100"
                          }`}
                        >
                          📍 Location
                        </button>
                        <button
                          onClick={() => setActiveSection("agency")}
                          className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                            activeSection === "agency"
                              ? "bg-[#0088cc] text-white"
                              : "bg-white text-[#0088cc] border border-slate-100"
                          }`}
                        >
                          🧾 Agency
                        </button>
                      </div>

                      {/* Submit Button */}
                      {activeSection === "complete" && (
                        <>
                          <div className="border-t border-slate-200 my-3"></div>
                          <button className="w-full py-3 px-4 bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-md hover:bg-emerald-600 transition-all">
                            ✅ CREATE TICKET
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
