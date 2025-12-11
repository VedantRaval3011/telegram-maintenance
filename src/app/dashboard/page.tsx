"use client";
import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import useSWR from "swr";
import Navbar from "@/components/Navbar";
import FilterBar from "@/components/FilterBar";
import SyncUsersButton from "@/components/SyncUsersButton";
import TicketCard from "@/components/TicketCard";
import Capsule from "@/components/Capsule";

const fetcher = (url: string) => fetch(url).then(r => r.json());



export default function DashboardPage() {
  const { data, error, mutate } = useSWR("/api/tickets", fetcher, { refreshInterval: 3000 });
  const { data: usersData } = useSWR("/api/masters/users?limit=100", fetcher);
  const { data: categoriesData } = useSWR("/api/masters/categories?limit=100", fetcher);
  const { data: subCategoriesData } = useSWR("/api/masters/subcategories?limit=100", fetcher);
  const { data: agenciesData } = useSWR("/api/masters/agencies?limit=100", fetcher);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false); // Track if showing completed view
  const [showUpArrow, setShowUpArrow] = useState(false); // Track if up arrow should be shown
  const [subCategorySearch, setSubCategorySearch] = useState(""); // Search term for subcategories
  const [agencySearch, setAgencySearch] = useState(""); // Search term for agencies
  const [showSubCategoryModal, setShowSubCategoryModal] = useState(false); // Show subcategory selection modal
  const scrollPosition = useRef<number>(0); // Store scroll position before jumping
  const clickedElementRef = useRef<HTMLElement | null>(null); // Store reference to clicked category element
  const ticketListRef = useRef<HTMLDivElement>(null); // Ref for ticket list section
  const [showUserCapsules, setShowUserCapsules] = useState(true); // Toggle user capsules visibility


  const [filters, setFiltersState] = useState({
    category: "",
    subCategory: "",
    location: "",
    status: "", // Default to show all (both PENDING and COMPLETED)
    priority: "", // Priority filter
    user: "", // User filter
    name: "",
    dateFrom: "",
    dateTo: "",
    timeFrom: "",
    timeTo: "",
    sortBy: "",
  });

  const setFilters = useCallback((patch: Partial<typeof filters>) => {
    setFiltersState(prev => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState({
      category: "",
      subCategory: "",
      location: "",
      status: "", // Reset to show all items
      priority: "",
      user: "",
      name: "",
      dateFrom: "",
      dateTo: "",
      timeFrom: "",
      timeTo: "",
      sortBy: "",
    });
  }, []);

  // Scroll to ticket list and save current position
  const scrollToTicketList = useCallback(() => {
    scrollPosition.current = window.scrollY;
    setShowUpArrow(true);
    setTimeout(() => {
      if (ticketListRef.current) {
        const elementPosition = ticketListRef.current.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = elementPosition - 100; // 100px offset to show full ticket
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      }
    }, 100);
  }, []);

  // Scroll back to saved position and clear selections
  const scrollBackToTop = useCallback(() => {
    if (clickedElementRef.current) {
      // Scroll to the clicked category element position
      const elementPosition = clickedElementRef.current.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - 80; // 80px offset for navbar
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    } else {
      // Fallback to saved scroll position
      window.scrollTo({ top: scrollPosition.current, behavior: 'smooth' });
    }
    setShowUpArrow(false);
    // Don't clear filters - keep the category selected so user can see the filtered tickets
  }, []);

  // Double-click on background to reset filters and show all pending data
  useEffect(() => {
    const handleDoubleClickReset = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if double-click is on the background (not on interactive elements)
      // Exclude clicks on buttons, capsules, tickets, inputs, etc.
      const isInteractiveElement = target.closest('button, a, input, textarea, select, [role="button"]');
      const isCapsule = target.closest('[class*="rounded-2xl"]') || target.closest('[class*="rounded-xl"]');
      
      // Only reset if clicked on the background (body or main container divs)
      const isBackground = target.tagName === 'BODY' || 
                          target.classList.contains('min-h-screen') ||
                          target.classList.contains('dashboard-content') ||
                          (target.tagName === 'DIV' && !target.hasAttribute('id') && !isCapsule);
      
      if (isBackground && !isInteractiveElement) {
        // Reset to show all pending data
        resetFilters();
        setSelectedCategory(null);
        setShowUpArrow(false);
        clickedElementRef.current = null;
        
        // Scroll to pending section
        setTimeout(() => {
          const pendingDiv = document.getElementById('pending-capsule');
          if (pendingDiv) {
            const elementPosition = pendingDiv.getBoundingClientRect().top + window.scrollY;
            const offsetPosition = elementPosition - 80; // 80px offset for navbar
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
          }
        }, 100);
      }
    };

    document.addEventListener('dblclick', handleDoubleClickReset);
    return () => document.removeEventListener('dblclick', handleDoubleClickReset);
  }, []);

  const tickets = data && Array.isArray(data.data) ? data.data : [];
  const users = usersData?.data || [];
  const categories = categoriesData?.data || [];
  const subCategories = subCategoriesData?.data || [];
  const agencies = agenciesData?.data || [];

  // Helper to calculate stats
  const calculateStats = useCallback((subset: any[]) => {
    const total = subset.length;
    const priority = {
      high: subset.filter((t: any) => (t.priority || "").toLowerCase() === "high").length,
      medium: subset.filter((t: any) => (t.priority || "").toLowerCase() === "medium").length,
      low: subset.filter((t: any) => (t.priority || "").toLowerCase() === "low").length,
    };

    // Source calculation based on category agency
    let inHouse = 0;
    let outsource = 0;

    subset.forEach((t: any) => {
      const catName = (t.category || "").toLowerCase();
      const cat = categories.find((c: any) => c.name.toLowerCase() === catName);
      if (cat && cat.agency) {
        outsource++;
      } else {
        inHouse++;
      }
    });

    return { total, priority, source: { inHouse, outsource } };
  }, [categories]);

  // Filter logic split into base (global filters) and full (including category/sub selection)
  const baseFiltered = useMemo(() => {
    const {
      location, status, priority, user, name,
      dateFrom, dateTo, timeFrom, timeTo
    } = filters;

    let out = tickets.slice();

    // Apply showCompleted filter first - this overrides status filter
    if (showCompleted) {
      out = out.filter((t: any) => (t.status || "").toString().toLowerCase() === "completed");
    } else {
      out = out.filter((t: any) => (t.status || "").toString().toLowerCase() === "pending");
    }

    if (location) out = out.filter((t: any) => (t.location || "").toString().toLowerCase() === location.toLowerCase());
    // Don't apply status filter here since we're using showCompleted
    if (priority) out = out.filter((t: any) => (t.priority || "").toString().toLowerCase() === priority.toLowerCase());

    if (user) {
      out = out.filter((t: any) => {
        const createdBy = (t.createdBy || "").toString().toLowerCase();
        return createdBy.includes(user.toLowerCase());
      });
    }

    if (name) {
      const q = name.toLowerCase();
      out = out.filter((t: any) => {
        const createdBy = (t.createdBy || "").toString().toLowerCase();
        const description = (t.description || "").toString().toLowerCase();
        return createdBy.includes(q) || description.includes(q);
      });
    }

    const parseTicketDate = (t: any) => {
      const raw = t.createdAt || t.createdOn || t.created_at || t.created;
      if (!raw) return null;
      try {
        return new Date(raw);
      } catch {
        return null;
      }
    };

    if (dateFrom) {
      const dFrom = new Date(dateFrom + "T00:00:00");
      out = out.filter((t: any) => {
        const d = parseTicketDate(t);
        return d ? d >= dFrom : false;
      });
    }
    if (dateTo) {
      const dTo = new Date(dateTo + "T23:59:59");
      out = out.filter((t: any) => {
        const d = parseTicketDate(t);
        return d ? d <= dTo : false;
      });
    }

    if (timeFrom || timeTo) {
      out = out.filter((t: any) => {
        const d = parseTicketDate(t);
        if (!d) return false;
        const hhmm = `${d.getHours()}`.padStart(2, "0") + ":" + `${d.getMinutes()}`.padStart(2, "0");
        if (timeFrom && hhmm < timeFrom) return false;
        if (timeTo && hhmm > timeTo) return false;
        return true;
      });
    }

    return out;
  }, [tickets, filters, showCompleted]);

  // Global Stats Base: Respects everything EXCEPT Category/SubCategory and Status
  // This ensures Global Capsules (Pending/Completed) change with Priority/Location/User/Date/Time, but NOT Category.
  const globalStatsBase = useMemo(() => {
    const {
      location, priority, user, name,
      dateFrom, dateTo, timeFrom, timeTo
    } = filters;

    let out = tickets.slice();

    if (location) out = out.filter((t: any) => (t.location || "").toString().toLowerCase() === location.toLowerCase());
    // Note: Status is NOT filtered here because we calculate Pending/Completed stats from this base.
    if (priority) out = out.filter((t: any) => (t.priority || "").toString().toLowerCase() === priority.toLowerCase());

    if (user) {
      out = out.filter((t: any) => {
        const createdBy = (t.createdBy || "").toString().toLowerCase();
        return createdBy.includes(user.toLowerCase());
      });
    }

    if (name) {
      const q = name.toLowerCase();
      out = out.filter((t: any) => {
        const createdBy = (t.createdBy || "").toString().toLowerCase();
        const description = (t.description || "").toString().toLowerCase();
        return createdBy.includes(q) || description.includes(q);
      });
    }

    const parseTicketDate = (t: any) => {
      const raw = t.createdAt || t.createdOn || t.created_at || t.created;
      if (!raw) return null;
      try {
        return new Date(raw);
      } catch {
        return null;
      }
    };

    if (dateFrom) {
      const dFrom = new Date(dateFrom + "T00:00:00");
      out = out.filter((t: any) => {
        const d = parseTicketDate(t);
        return d ? d >= dFrom : false;
      });
    }
    if (dateTo) {
      const dTo = new Date(dateTo + "T23:59:59");
      out = out.filter((t: any) => {
        const d = parseTicketDate(t);
        return d ? d <= dTo : false;
      });
    }

    if (timeFrom || timeTo) {
      out = out.filter((t: any) => {
        const d = parseTicketDate(t);
        if (!d) return false;
        const hhmm = `${d.getHours()}`.padStart(2, "0") + ":" + `${d.getMinutes()}`.padStart(2, "0");
        if (timeFrom && hhmm < timeFrom) return false;
        if (timeTo && hhmm > timeTo) return false;
        return true;
      });
    }

    return out;
  }, [tickets, filters]);

  const fullyFiltered = useMemo(() => {
    let out = baseFiltered.slice();
    const { category, subCategory, sortBy } = filters;

    if (category) out = out.filter((t: any) => (t.category || "").toString().toLowerCase() === category.toLowerCase());
    if (subCategory) out = out.filter((t: any) => (t.subCategory || "").toString().toLowerCase() === subCategory.toLowerCase());

    if (sortBy) {
      const parseTicketDate = (t: any) => {
        const raw = t.createdAt || t.createdOn || t.created_at || t.created;
        if (!raw) return null;
        try { return new Date(raw); } catch { return null; }
      };

      if (sortBy === "created_desc") {
        out.sort((a: any, b: any) => (parseTicketDate(b)?.getTime() ?? 0) - (parseTicketDate(a)?.getTime() ?? 0));
      } else if (sortBy === "created_asc") {
        out.sort((a: any, b: any) => (parseTicketDate(a)?.getTime() ?? 0) - (parseTicketDate(b)?.getTime() ?? 0));
      } else if (sortBy === "priority_desc") {
        out.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
      } else if (sortBy === "priority_asc") {
        out.sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0));
      } else if (sortBy === "category_asc") {
        out.sort((a: any, b: any) => String(a.category || "").localeCompare(String(b.category || "")));
      } else if (sortBy === "category_desc") {
        out.sort((a: any, b: any) => String(b.category || "").localeCompare(String(a.category || "")));
      } else if (sortBy === "location_asc") {
        out.sort((a: any, b: any) => String(a.location || "").localeCompare(String(b.location || "")));
      }
    }

    return out;
  }, [baseFiltered, filters]);

  const stats = useMemo(() => {
    // Global Stats - use globalStatsBase (ignores Category, respects Priority)
    const totalStats = calculateStats(globalStatsBase);
    const pendingStats = calculateStats(globalStatsBase.filter((t: any) => t.status === "PENDING"));
    const completedStats = calculateStats(globalStatsBase.filter((t: any) => t.status === "COMPLETED"));

    // Category Stats - use baseFiltered (exclude category filter) so we see all categories
    const categoryStats = categories.map((cat: any) => {
      const catTickets = baseFiltered.filter((t: any) => (t.category || "").toLowerCase() === cat.name.toLowerCase());
      return {
        id: cat._id,
        name: cat.displayName,
        stats: calculateStats(catTickets),
        color: cat.color,
      };
    }).filter((c: any) => c.stats.total > 0);

    // User Stats - use fullyFiltered to show users relevant to current view
    const userStats = users.map((u: any) => {
      const displayName = u.username || `${u.firstName || ""} ${u.lastName || ""}`.trim() || `User ${u.telegramId}`;
      const uTickets = fullyFiltered.filter((t: any) => {
        const createdBy = (t.createdBy || "").toString().toLowerCase();
        return createdBy.includes(displayName.toLowerCase()) || createdBy === u.telegramId?.toString();
      });
      return {
        id: u._id,
        name: displayName,
        stats: calculateStats(uTickets),
      };
    }).filter((u: any) => u.stats.total > 0);

    // Subcategory Stats - use baseFiltered + category filter (exclude subCategory filter)
    let subCategoryStats: any[] = [];
    if (selectedCategory) {
      const cat = categories.find((c: any) => c._id === selectedCategory);
      if (cat) {
        // Filter tickets by this category only (ignore subCategory filter for the list stats)
        const catTickets = baseFiltered.filter((t: any) => (t.category || "").toLowerCase() === cat.name.toLowerCase());
        const relevantSubs = subCategories.filter((s: any) => s.categoryId === selectedCategory);

        subCategoryStats = relevantSubs.map((sub: any) => {
          const subTickets = catTickets.filter((t: any) =>
            (t.subCategory || "").toLowerCase() === sub.name.toLowerCase()
          );
          return {
            id: sub._id,
            name: sub.name,
            stats: calculateStats(subTickets),
          };
        });
      }
    }

    return { totalStats, pendingStats, completedStats, categoryStats, userStats, subCategoryStats };
  }, [fullyFiltered, baseFiltered, categories, users, subCategories, selectedCategory, calculateStats]);

  if (error)
    return <div className="p-10 text-center text-red-500">Failed to load</div>;
  if (!data)
    return <div className="p-10 text-center text-gray-500 animate-pulse">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 lg:px-8 dashboard-content">
        {/* Top Filters: Advanced Toggle */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-end gap-4 mb-6">
          {/* Advanced Filters Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all border border-gray-200 shadow-sm"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showAdvancedFilters ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Advanced Filters
            </button>
            <button
              onClick={() => {
                setShowCompleted(!showCompleted);
                // When switching to completed view, reset filters
                if (!showCompleted) {
                  resetFilters();
                }
              }}
              className={`px-4 py-2.5 rounded-xl font-medium transition-all shadow-sm ${
                showCompleted 
                  ? "bg-teal-600 text-white hover:bg-teal-700" 
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {showCompleted ? "Show Pending" : "Completed"}
            </button>
            {(filters.category || filters.location || filters.priority || filters.user || filters.name || filters.dateFrom || filters.dateTo) && (
              <button
                onClick={resetFilters}
                className="px-4 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-all shadow-sm"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="mb-8">
            <FilterBar tickets={tickets} filters={filters} setFilters={setFilters} reset={resetFilters} />
          </div>
        )}

        {/* Summary Stats */}
        <div className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {!showCompleted ? (
              <div id="pending-capsule">
                <Capsule
                  title="Pending"
                  {...stats.pendingStats}
                  onClick={() => {
                    // Save reference to pending capsule and scroll to ticket list
                    const pendingDiv = document.getElementById('pending-capsule');
                    if (pendingDiv) {
                      clickedElementRef.current = pendingDiv;
                    }
                    setFilters({ category: "", status: "" });
                    setSelectedCategory(null);
                    scrollToTicketList();
                  }}
                  onPriorityClick={(p) => setFilters({ priority: p })}
                  selectedPriority={filters.priority}
                  color="#3b82f6"
                  className={filters.status === "PENDING" ? "ring-2 ring-gray-900 ring-offset-2" : ""}
                  onScrollBack={scrollBackToTop}
                />
              </div>
            ) : (
              <div id="completed-capsule">
                <Capsule
                  title="Completed"
                  {...stats.completedStats}
                  onClick={() => {
                    // Save reference to completed capsule and scroll to ticket list
                    const completedDiv = document.getElementById('completed-capsule');
                    if (completedDiv) {
                      clickedElementRef.current = completedDiv;
                    }
                    setFilters({ status: filters.status === "COMPLETED" ? "" : "COMPLETED" });
                    scrollToTicketList();
                  }}
                  onPriorityClick={(p) => setFilters({ priority: p })}
                  selectedPriority={filters.priority}
                  color="#14b8a6"
                  className={filters.status === "COMPLETED" ? "ring-2 ring-gray-900 ring-offset-2" : ""}
                  onScrollBack={scrollBackToTop}
                />
              </div>
            )}
          </div>
        </div>

        {/* Category Stats Capsules */}
        {stats.categoryStats.length > 0 && (
          <div className="mb-12">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">By Category</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats.categoryStats.map((cat: any) => (
                <div key={cat.id} className="relative" id={`category-${cat.id}`}>
                  <Capsule
                    title={cat.name}
                    {...cat.stats}
                    onClick={() => {
                      const isAll = cat.id === "all";
                      const isCurrentlySelected = selectedCategory === cat.id || 
                        (cat.id === "all" ? filters.category === "" : filters.category === cat.name);
                      
                      if (isCurrentlySelected) {
                        // Deselect if already selected
                        setFilters({ category: "" });
                        setSelectedCategory(null);
                      } else {
                        // Save reference to clicked element
                        const clickedDiv = document.getElementById(`category-${cat.id}`);
                        if (clickedDiv) {
                          clickedElementRef.current = clickedDiv;
                        }
                        
                        // Select the category and scroll to ticket list
                        setFilters({ category: isAll ? "" : cat.name });
                        setSelectedCategory(isAll ? null : cat.id);
                        if (!isAll) {
                          scrollToTicketList();
                        }
                      }
                    }}
                    onPriorityClick={(p) => setFilters({ priority: p })}
                    selectedPriority={filters.priority}
                    color={cat.color || "#6b7280"}
                    className={(selectedCategory === cat.id || (cat.id === "all" ? filters.category === "" : filters.category === cat.name)) ? "ring-2 ring-gray-900 ring-offset-2" : ""}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subcategories Section */}
        {selectedCategory && (
          <div className="mb-12">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Subcategories for {categories.find((c: any) => c._id === selectedCategory)?.displayName}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSubCategoryModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all shadow-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Select SubCategories
                </button>
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setSubCategorySearch(""); // Clear search when closing
                  }}
                  className="text-sm text-gray-600 hover:text-gray-900 underline font-medium"
                >
                  Close
                </button>
              </div>
            </div>

            {(() => {
              // Filter subcategories: by search term AND exclude those with 0 total tickets
              const filteredSubCategories = stats.subCategoryStats.filter((sub: any) =>
                sub.name.toLowerCase().includes(subCategorySearch.toLowerCase()) &&
                (sub.stats.total > 0) // Only show subcategories with at least 1 ticket
              );

              return filteredSubCategories.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredSubCategories.map((sub: any) => (
                    <div key={sub.id} id={`subcategory-${sub.id}`}>
                      <Capsule
                        title={sub.name}
                        {...sub.stats}
                        onClick={() => {
                          // Save reference to clicked subcategory element
                          const subDiv = document.getElementById(`subcategory-${sub.id}`);
                          if (subDiv) {
                            clickedElementRef.current = subDiv;
                          }
                          
                          // Filter by this subcategory and scroll to ticket list
                          const cat = categories.find((c: any) => c._id === selectedCategory);
                          setFilters({
                            category: cat ? cat.name : "",
                            subCategory: sub.name
                          });
                          scrollToTicketList();
                        }}
                        className={filters.subCategory === sub.name ? "ring-2 ring-gray-900 ring-offset-2" : ""}
                        onPriorityClick={(p) => setFilters({ priority: p })}
                        selectedPriority={filters.priority}
                        color={categories.find((c: any) => c._id === selectedCategory)?.color || "#6b7280"}
                        onScrollBack={scrollBackToTop}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 italic px-4">
                  {subCategorySearch ? `No subcategories found matching "${subCategorySearch}"` : "No tickets found for subcategories in this category."}
                </div>
              );
            })()}
          </div>
        )}



        {/* User Stats Capsules */}
        {stats.userStats.length > 0 && (
          <div className="mb-12">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">By User</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats.userStats.map((u: any) => (
                <Capsule
                  key={u.id}
                  title={u.name}
                  {...u.stats}
                  onClick={() => setFilters({ user: u.name })}
                  onPriorityClick={(p) => setFilters({ priority: p })}
                  selectedPriority={filters.priority}
                  color="#06b6d4"
                  className={filters.user === u.name ? "ring-2 ring-gray-900 ring-offset-2" : ""}
                />
              ))}
            </div>
          </div>
        )}



        {/* Priority Filter Section */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Filter by Priority:</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilters({ priority: "" })}
                    className={`px-4 py-2 rounded-lg font-medium transition-all border-2 ${filters.priority === ""
                        ? "bg-gray-800 text-white border-gray-800 shadow-md"
                        : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                      }`}
                  >
                    All Priorities
                  </button>
                  <button
                    onClick={() => setFilters({ priority: "high" })}
                    className={`px-4 py-2 rounded-lg font-medium transition-all border-2 flex items-center gap-2 ${filters.priority === "high"
                        ? "bg-red-500 text-white border-red-500 shadow-md"
                        : "bg-red-50 text-red-700 border-red-300 hover:border-red-400"
                      }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    High
                  </button>
                  <button
                    onClick={() => setFilters({ priority: "medium" })}
                    className={`px-4 py-2 rounded-lg font-medium transition-all border-2 flex items-center gap-2 ${filters.priority === "medium"
                        ? "bg-amber-500 text-white border-amber-500 shadow-md"
                        : "bg-amber-50 text-amber-700 border-amber-300 hover:border-amber-400"
                      }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Medium
                  </button>
                  <button
                    onClick={() => setFilters({ priority: "low" })}
                    className={`px-4 py-2 rounded-lg font-medium transition-all border-2 flex items-center gap-2 ${filters.priority === "low"
                        ? "bg-emerald-500 text-white border-emerald-500 shadow-md"
                        : "bg-emerald-50 text-emerald-700 border-emerald-300 hover:border-emerald-400"
                      }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Low
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Toggle User Capsules Button */}
                <button
                  onClick={() => setShowUserCapsules(!showUserCapsules)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all border-2 flex items-center gap-2 ${
                    showUserCapsules
                      ? "bg-blue-500 text-white border-blue-500 shadow-md"
                      : "bg-gray-100 text-gray-600 border-gray-300 hover:border-gray-400"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showUserCapsules ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    )}
                  </svg>
                  {showUserCapsules ? "Hide Users" : "Show Users"}
                </button>
                <div className="text-sm text-gray-600 font-medium">
                  Showing <span className="text-gray-900 font-bold">{fullyFiltered.length}</span> ticket{fullyFiltered.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tickets grid */}
        <div ref={ticketListRef} className="grid grid-cols-1 gap-6">
          {fullyFiltered.map((t: any) => {
            const cat = categories.find((c: any) => c.name.toLowerCase() === (t.category || "").toLowerCase());
            return (
              <TicketCard
                key={t.ticketId}
                ticket={t}
                onStatusChange={() => mutate()}
                categoryColor={cat?.color}
                onScrollBack={scrollBackToTop}
              />
            );
          })}
        </div>

        {fullyFiltered.length === 0 && (
          <div className="mt-6 text-center text-gray-500">No tickets match the current filters.</div>
        )}
      </div>

      {/* Subcategory Selection Modal */}
      {showSubCategoryModal && selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" onClick={() => setShowSubCategoryModal(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative max-w-2xl w-full rounded-2xl shadow-2xl bg-gradient-to-br from-gray-800 to-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">Select SubCategories</h2>
                    {(() => {
                      // Find the selected subcategory and its associated agency
                      if (filters.subCategory) {
                        const selectedSub = subCategories.find((s: any) => s.name === filters.subCategory);
                        if (selectedSub && selectedSub.agencies && selectedSub.agencies.length > 0) {
                          const agency = agencies.find((a: any) => selectedSub.agencies.includes(a._id));
                          if (agency) {
                            return (
                              <span className="px-3 py-1 bg-yellow-600 text-white text-sm font-medium rounded-lg">
                                {agency.name}
                              </span>
                            );
                          }
                        }
                      }
                      return null;
                    })()}
                  </div>
                  <p className="text-sm text-gray-400">Click on subcategories to select/deselect</p>
                </div>
              </div>
              <button
                onClick={() => setShowSubCategoryModal(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Input */}
            <div className="p-6 pb-2">
              <div className="relative mb-3">
                <input
                  type="text"
                  placeholder="Search subcategories..."
                  value={subCategorySearch}
                  onChange={(e) => setSubCategorySearch(e.target.value)}
                  className="w-full px-4 py-3 pl-10 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400"
                />
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              {/* Agency Search Filter */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by agency (Open Chart)..."
                  value={agencySearch}
                  onChange={(e) => setAgencySearch(e.target.value)}
                  className="w-full px-4 py-3 pl-10 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all placeholder-gray-400"
                />
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-yellow-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Subcategory List */}
            <div className="px-6 pb-4 max-h-96 overflow-y-auto">
              {(() => {
                // Filter by subcategory name and agency name
                const filteredSubs = stats.subCategoryStats.filter((sub: any) => {
                  const matchesSubName = sub.name.toLowerCase().includes(subCategorySearch.toLowerCase());
                  
                  // Check if agency search is active
                  if (agencySearch) {
                    const subData = subCategories.find((s: any) => s.name === sub.name);
                    if (subData && subData.agencies && subData.agencies.length > 0) {
                      const hasMatchingAgency = subData.agencies.some((agencyId: string) => {
                        const agency = agencies.find((a: any) => a._id === agencyId);
                        return agency && agency.name.toLowerCase().includes(agencySearch.toLowerCase());
                      });
                      return matchesSubName && hasMatchingAgency;
                    }
                    return false; // If agency search is active but sub has no agencies, exclude it
                  }
                  
                  return matchesSubName;
                });

                return filteredSubs.length > 0 ? (
                  <div className="space-y-2">
                    {/* Category Header */}
                    <div className="flex items-center gap-2 py-2">
                      <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                      <span className="font-semibold text-white">
                        {categories.find((c: any) => c._id === selectedCategory)?.displayName}
                      </span>
                    </div>

                    {/* Subcategory Items */}
                    {filteredSubs.map((sub: any) => (
                      <button
                        key={sub.id}
                        onClick={() => {
                          const cat = categories.find((c: any) => c._id === selectedCategory);
                          setFilters({
                            category: cat ? cat.name : "",
                            subCategory: filters.subCategory === sub.name ? "" : sub.name
                          });
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-700 rounded-lg transition-colors group"
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          filters.subCategory === sub.name
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-500 group-hover:border-gray-400'
                        }`}>
                          {filters.subCategory === sub.name && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-gray-300 group-hover:text-white transition-colors flex-1 text-left">
                          {sub.name}
                        </span>
                        <span className="text-xs text-gray-500">({sub.stats.total})</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    No subcategories found matching "{subCategorySearch}"
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-700">
              <span className="text-sm text-gray-400">
                {filters.subCategory ? '1 item selected' : '0 items selected'}
              </span>
              <div className="flex items-center gap-3">
                {filters.subCategory && (
                  <button
                    onClick={() => setFilters({ subCategory: "" })}
                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowSubCategoryModal(false);
                    if (filters.subCategory) {
                      scrollToTicketList();
                    }
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all shadow-lg"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
