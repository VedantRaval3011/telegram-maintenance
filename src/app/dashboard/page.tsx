"use client";
import React, { Suspense, useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import Navbar from "@/components/Navbar";
import FilterBar from "@/components/FilterBar";
import SyncUsersButton from "@/components/SyncUsersButton";
import TicketCard from "@/components/TicketCard";
import Capsule from "@/components/Capsule";

const fetcher = (url: string) => fetch(url).then(r => r.json());

// Loading fallback for Suspense
function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navbar />
      <div className="p-10 text-center text-gray-500 animate-pulse">Loading dashboard…</div>
    </div>
  );
}

// Main dashboard content component that uses useSearchParams
function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [showSubCategoriesSection, setShowSubCategoriesSection] = useState(false); // Control subcategories section visibility
  const scrollPosition = useRef<number>(0); // Store scroll position before jumping
  const clickedElementRef = useRef<HTMLElement | null>(null); // Store reference to clicked category element
  const ticketListRef = useRef<HTMLDivElement>(null); // Ref for ticket list section
  const [showAgencyCapsules, setShowAgencyCapsules] = useState(false); // Toggle agency capsules visibility
  const [filtersInitialized, setFiltersInitialized] = useState(false); // Track if filters have been initialized from URL


  const [filters, setFiltersState] = useState({
    category: "",
    subCategory: "",
    location: "",
    status: "", // Default to show all (both PENDING and COMPLETED)
    priority: "", // Priority filter
    user: "", // User filter
    agency: "", // Agency filter
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
      agency: "",
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
        const offsetPosition = elementPosition - 120; // 120px offset to show priority filters and tickets clearly
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
        setShowSubCategoriesSection(false); // Hide subcategories section
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

  // Initialize filters from URL parameters (e.g., when navigating from summary page)
  useEffect(() => {
    // Only run if we have category data and haven't initialized yet
    if (!filtersInitialized && categoriesData?.data && Array.isArray(categoriesData.data)) {
      const category = searchParams.get('category');
      const priority = searchParams.get('priority');
      const status = searchParams.get('status');

      if (category || priority || status) {
        const newFilters: Partial<typeof filters> = {};

        if (category) {
          newFilters.category = category;
          // Find and set the selected category ID
          const cat = categoriesData.data.find((c: any) => c.name === category);
          if (cat) {
            setSelectedCategory(cat._id);
          }
        }

        if (priority) {
          newFilters.priority = priority;
        }

        if (status) {
          newFilters.status = status;
          // Set showCompleted based on status
          if (status === 'COMPLETED') {
            setShowCompleted(true);
          }
        }

        // Apply filters immediately
        setFilters(newFilters);

        // Mark as initialized
        setFiltersInitialized(true);

        // Scroll to ticket list after filters are applied and data is rendered
        setTimeout(() => {
          scrollToTicketList();
        }, 800);
      } else {
        setFiltersInitialized(true);
      }
    }
  }, [searchParams, categoriesData, filtersInitialized, setFilters, scrollToTicketList]);

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
    // Note: Priority is NOT filtered here so that Pending/Completed capsules show ALL priorities counts (unchanged by selection).

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

  // Category Stats Base: Respects location, user, name, date/time filters but NOT priority or category
  // This ensures category capsules always show their full stats, not filtered by priority
  const categoryStatsBase = useMemo(() => {
    const {
      location, user, name,
      dateFrom, dateTo, timeFrom, timeTo
    } = filters;

    let out = tickets.slice();

    // Apply showCompleted filter first
    if (showCompleted) {
      out = out.filter((t: any) => (t.status || "").toString().toLowerCase() === "completed");
    } else {
      out = out.filter((t: any) => (t.status || "").toString().toLowerCase() === "pending");
    }

    if (location) out = out.filter((t: any) => (t.location || "").toString().toLowerCase() === location.toLowerCase());
    // Note: Priority is NOT filtered here so category capsules show all priorities

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

  const fullyFiltered = useMemo(() => {
    let out = baseFiltered.slice();
    const { category, subCategory, agency, sortBy } = filters;

    if (category) out = out.filter((t: any) => (t.category || "").toString().toLowerCase() === category.toLowerCase());
    if (subCategory) out = out.filter((t: any) => (t.subCategory || "").toString().toLowerCase() === subCategory.toLowerCase());

    // Filter by agency - show tickets whose subcategories are linked to this agency
    if (agency) {
      const agencyData = agencies.find((a: any) => a._id === agency);
      if (agencyData && agencyData.subCategories) {
        const linkedSubCategoryIds = agencyData.subCategories.map((s: any) => s._id || s);
        out = out.filter((t: any) => {
          const ticketSubCategory = subCategories.find((s: any) =>
            s.name.toLowerCase() === (t.subCategory || "").toLowerCase()
          );
          return ticketSubCategory && linkedSubCategoryIds.includes(ticketSubCategory._id);
        });
      }
    }

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
  }, [baseFiltered, filters, agencies, subCategories]);

  const stats = useMemo(() => {
    // Global Stats - use globalStatsBase (ignores Category, respects Priority)
    const totalStats = calculateStats(globalStatsBase);
    const pendingStats = calculateStats(globalStatsBase.filter((t: any) => t.status === "PENDING"));
    const completedStats = calculateStats(globalStatsBase.filter((t: any) => t.status === "COMPLETED"));

    // Category Stats - use categoryStatsBase (excludes priority and category filters) so each category shows its full stats
    const categoryStats = categories.map((cat: any) => {
      const catTickets = categoryStatsBase.filter((t: any) => (t.category || "").toLowerCase() === cat.name.toLowerCase());
      return {
        id: cat._id,
        name: cat.displayName, // Display name for UI
        internalName: cat.name, // Internal name for filtering
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

    // Subcategory Stats - use categoryStatsBase + category filter (exclude priority and subCategory filter)
    let subCategoryStats: any[] = [];
    if (selectedCategory) {
      const cat = categories.find((c: any) => c._id === selectedCategory);
      if (cat) {
        // Filter tickets by this category only (ignore subCategory and priority filters for the list stats)
        const catTickets = categoryStatsBase.filter((t: any) => (t.category || "").toLowerCase() === cat.name.toLowerCase());
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

    // Agency Stats - use categoryStatsBase to show complete agency stats regardless of priority
    const agencyStats = agencies.map((agency: any) => {
      // Get all subcategories linked to this agency
      const linkedSubCategoryIds = agency.subCategories?.map((s: any) => s._id || s) || [];

      // Find tickets that match any of the linked subcategories
      const agencyTickets = categoryStatsBase.filter((t: any) => {
        const ticketSubCategory = subCategories.find((s: any) =>
          s.name.toLowerCase() === (t.subCategory || "").toLowerCase()
        );
        return ticketSubCategory && linkedSubCategoryIds.includes(ticketSubCategory._id);
      });

      return {
        id: agency._id,
        name: agency.name,
        stats: calculateStats(agencyTickets),
      };
    }).filter((a: any) => a.stats.total > 0); // Only show agencies with pending work

    return { totalStats, pendingStats, completedStats, categoryStats, userStats, subCategoryStats, agencyStats };
  }, [fullyFiltered, baseFiltered, categoryStatsBase, globalStatsBase, categories, users, subCategories, selectedCategory, calculateStats, agencies]);

  if (error)
    return <div className="p-10 text-center text-red-500">Failed to load</div>;
  if (!data)
    return <div className="p-10 text-center text-gray-500 animate-pulse">Loading…</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 dashboard-content">
        {/* Top Filters: Advanced Toggle */}
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 mb-4 sm:mb-6">
          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white text-gray-700 rounded-xl text-sm sm:text-base font-medium hover:bg-gray-50 transition-all border border-gray-200 shadow-sm"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showAdvancedFilters ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span className="hidden sm:inline">Advanced </span>Filters
          </button>
          <button
            onClick={() => {
              setShowCompleted(!showCompleted);
              // When switching to completed view, reset filters
              if (!showCompleted) {
                resetFilters();
              }
            }}
            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm sm:text-base font-medium transition-all shadow-sm ${showCompleted
              ? "bg-teal-600 text-white hover:bg-teal-700"
              : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
          >
            {showCompleted ? "Show Pending" : "Completed"}
          </button>
          {(filters.category || filters.location || filters.priority || filters.user || filters.agency || filters.name || filters.dateFrom || filters.dateTo) && (
            <button
              onClick={resetFilters}
              className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-900 text-white rounded-xl text-sm sm:text-base font-medium hover:bg-gray-800 transition-all shadow-sm"
            >
              Reset
            </button>
          )}
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="mb-8">
            <FilterBar tickets={tickets} filters={filters} setFilters={setFilters} reset={resetFilters} />
          </div>
        )}

        {/* Summary Stats */}
        <div className="mb-8 sm:mb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
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
                    const newStatus = "";
                    setFilters({ category: "", status: newStatus, priority: "" });
                    setSelectedCategory(null);
                    scrollToTicketList();
                    // Update URL
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete('category');
                    params.delete('priority');
                    if (newStatus) params.set('status', newStatus); else params.delete('status');
                    router.push(`/dashboard?${params.toString()}`);
                  }}
                  onPriorityClick={(p) => {
                    const newPriority = p; // Clicked priority
                    setFilters({ priority: newPriority });
                    scrollToTicketList();
                    // Update URL - user request: redirect to tickets page (dashboard with filter)
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('priority', newPriority);
                    router.push(`/dashboard?${params.toString()}`);
                  }}
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
                    const newStatus = filters.status === "COMPLETED" ? "" : "COMPLETED";
                    setFilters({ status: newStatus, priority: "" });
                    scrollToTicketList();
                    // Update URL
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete('priority');
                    if (newStatus) params.set('status', newStatus); else params.delete('status');
                    router.push(`/dashboard?${params.toString()}`);
                  }}
                  onPriorityClick={(p) => {
                    const newPriority = p;
                    setFilters({ priority: newPriority });
                    scrollToTicketList();
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('priority', newPriority);
                    router.push(`/dashboard?${params.toString()}`);
                  }}
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
          <div className="mb-8 sm:mb-12">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">By Category</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {stats.categoryStats.map((cat: any) => (
                <div key={cat.id} className="relative" id={`category-${cat.id}`}>
                  <Capsule
                    title={cat.name}
                    {...cat.stats}
                    onClick={() => {
                      const isAll = cat.id === "all";
                      const isCurrentlySelected = selectedCategory === cat.id ||
                        (cat.id === "all" ? filters.category === "" : filters.category === cat.internalName);

                      if (isCurrentlySelected) {
                        // Deselect if already selected
                        setFilters({ category: "", priority: "" });
                        setSelectedCategory(null);
                        setShowSubCategoriesSection(false); // Hide subcategories section
                        
                        // Update URL
                        const params = new URLSearchParams(searchParams.toString());
                        params.delete('category');
                        params.delete('priority');
                        router.push(`/dashboard?${params.toString()}`);
                      } else {
                        // Save reference to clicked element
                        const clickedDiv = document.getElementById(`category-${cat.id}`);
                        if (clickedDiv) {
                          clickedElementRef.current = clickedDiv;
                        }

                        // Select the category - use internalName for filtering
                        setFilters({ category: isAll ? "" : cat.internalName, priority: "", agency: "" });
                        setSelectedCategory(isAll ? null : cat.id);
                        setShowSubCategoriesSection(true); // Show subcategories section automatically
                        
                        // Update URL
                        const params = new URLSearchParams(searchParams.toString());
                        if (isAll) params.delete('category'); else params.set('category', cat.internalName);
                        params.delete('priority');
                        params.delete('agency');
                        router.push(`/dashboard?${params.toString()}`);

                        // Scroll to ticket list after a delay to ensure filters are applied and subcategories are rendered
                        if (!isAll) {
                          setTimeout(() => {
                            scrollToTicketList();
                          }, 500); // Increased delay to ensure subcategories section is fully rendered
                        }
                      }
                    }}
                    onPriorityClick={(p) => {
                      // Preserve category context when clicking priority
                      const newPriority = filters.priority === p ? "" : p;
                      setFilters({
                        priority: newPriority,
                        category: cat.internalName
                      });
                      scrollToTicketList();
                      // Update URL
                      const params = new URLSearchParams(searchParams.toString());
                      if (newPriority) params.set('priority', newPriority); else params.delete('priority');
                      params.set('category', cat.internalName);
                      router.push(`/dashboard?${params.toString()}`);
                    }}
                    selectedPriority={filters.priority}
                    color={cat.color || "#6b7280"}
                    className={(selectedCategory === cat.id || (cat.id === "all" ? filters.category === "" : filters.category === cat.internalName)) ? "ring-2 ring-gray-900 ring-offset-2" : ""}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subcategories Section */}
        {selectedCategory && showSubCategoriesSection && (
          <div className="mb-8 sm:mb-12">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                Subcategories for {categories.find((c: any) => c._id === selectedCategory)?.displayName}
              </h2>
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setShowSubCategoryModal(true)}
                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg text-sm sm:text-base font-medium hover:bg-blue-700 transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="hidden sm:inline">Select </span>SubCategories
                </button>
                <button
                  onClick={() => {
                    setShowSubCategoriesSection(false);
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
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

                          // Filter by this subcategory
                          const cat = categories.find((c: any) => c._id === selectedCategory);
                          setFilters({
                            category: cat ? cat.name : "",
                            subCategory: sub.name,
                            priority: ""
                          });

                          // Update URL
                          const params = new URLSearchParams(searchParams.toString());
                          if (cat) params.set('category', cat.name);
                          params.delete('priority');
                          // subCategory is not persisted in URL yet, but priority must be cleared
                          router.push(`/dashboard?${params.toString()}`);

                          // Scroll to ticket list after a delay to ensure filters are applied
                          setTimeout(() => {
                            scrollToTicketList();
                          }, 150);
                        }}
                        className={filters.subCategory === sub.name ? "ring-2 ring-gray-900 ring-offset-2" : ""}
                        onPriorityClick={(p) => {
                          // Preserve category context when clicking priority in subcategory
                          const cat = categories.find((c: any) => c._id === selectedCategory);
                          const newPriority = filters.priority === p ? "" : p;
                          setFilters({
                            priority: newPriority,
                            category: cat ? cat.name : filters.category,
                            subCategory: filters.subCategory
                          });
                          scrollToTicketList();
                          
                          // Update URL
                          const params = new URLSearchParams(searchParams.toString());
                          if (newPriority) params.set('priority', newPriority); else params.delete('priority');
                          if (cat) params.set('category', cat.name);
                          // Note: subCategories are not currently tracked in URL in this component's useEffect, 
                          // but we can add it if needed. For now, just priority and category redirect.
                          router.push(`/dashboard?${params.toString()}`);
                        }}
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




        {/* Agency Stats Capsules - Agency-wise Pending Work (Collapsible) */}
        {stats.agencyStats && stats.agencyStats.length > 0 && (
          <div className="mb-8 sm:mb-12">
            {/* Collapsible Header */}
            <div
              className="flex items-center justify-between mb-4 sm:mb-6 cursor-pointer group"
              onClick={() => setShowAgencyCapsules(!showAgencyCapsules)}
            >
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">By Agency</h2>
                <span className="text-xs sm:text-sm text-gray-500 font-medium">
                  ({stats.agencyStats.length} {stats.agencyStats.length === 1 ? 'agency' : 'agencies'})
                </span>
              </div>
              <button className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all shadow-sm">
                <svg
                  className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-600 transition-transform duration-300 ${showAgencyCapsules ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                <span className="text-xs sm:text-sm font-medium text-gray-700">
                  {showAgencyCapsules ? 'Hide' : 'Show'}
                </span>
              </button>
            </div>

            {/* Collapsible Content */}
            {showAgencyCapsules && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 animate-fadeIn">
                {stats.agencyStats.map((agency: any) => (
                  <Capsule
                    key={agency.id}
                    title={agency.name}
                    {...agency.stats}
                    onClick={() => {
                      // Toggle agency filter
                      if (filters.agency === agency.id) {
                        setFilters({ agency: "", priority: "" });
                        
                        const params = new URLSearchParams(searchParams.toString());
                        params.delete('priority');
                        // URL persistence for agency not fully implemented, but clear priority
                        router.push(`/dashboard?${params.toString()}`);
                      } else {
                        setFilters({ agency: agency.id, priority: "", category: "", subCategory: "" });
                        setSelectedCategory(null);
                        setShowSubCategoriesSection(false);
                        
                        const params = new URLSearchParams(searchParams.toString());
                        params.delete('priority');
                        params.delete('category');
                        // URL persistence for agency not fully implemented, but clear priority
                        router.push(`/dashboard?${params.toString()}`);
                        
                        // Scroll to ticket list after a delay to ensure filters are applied
                        setTimeout(() => {
                          scrollToTicketList();
                        }, 150);
                      }
                    }}
                    onPriorityClick={(p) => {
                      // Preserve agency context when clicking priority
                      const newPriority = filters.priority === p ? "" : p;
                      setFilters({
                        priority: newPriority,
                        agency: filters.agency
                      });
                      scrollToTicketList();
                      
                      const params = new URLSearchParams(searchParams.toString());
                      if (newPriority) params.set('priority', newPriority); else params.delete('priority');
                      // Agency is local state mostly, but if we want to persist:
                      // params.set('agency', filters.agency); 
                      // The current URL parsing in useEffect doesn't seem to look for 'agency', 
                      // but pushing it won't hurt.
                      router.push(`/dashboard?${params.toString()}`);
                    }}
                    selectedPriority={filters.priority}
                    color="#f59e0b"
                    className={filters.agency === agency.id ? "ring-2 ring-gray-900 ring-offset-2" : ""}
                  />
                ))}
              </div>
            )}
          </div>
        )}




        {/* Priority Filter Section */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-6">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <h3 className="text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wide">Priority:</h3>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setFilters({ priority: "" })}
                    className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all border-2 ${filters.priority === ""
                      ? "bg-gray-800 text-white border-gray-800 shadow-md"
                      : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                      }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilters({ priority: "high" })}
                    className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all border-2 flex items-center gap-1 sm:gap-2 ${filters.priority === "high"
                      ? "bg-red-500 text-white border-red-500 shadow-md"
                      : "bg-red-50 text-red-700 border-red-300 hover:border-red-400"
                      }`}
                  >
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500"></span>
                    High
                  </button>
                  <button
                    onClick={() => setFilters({ priority: "medium" })}
                    className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all border-2 flex items-center gap-1 sm:gap-2 ${filters.priority === "medium"
                      ? "bg-amber-500 text-white border-amber-500 shadow-md"
                      : "bg-amber-50 text-amber-700 border-amber-300 hover:border-amber-400"
                      }`}
                  >
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500"></span>
                    Med
                  </button>
                  <button
                    onClick={() => setFilters({ priority: "low" })}
                    className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all border-2 flex items-center gap-1 sm:gap-2 ${filters.priority === "low"
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-md"
                      : "bg-emerald-50 text-emerald-700 border-emerald-300 hover:border-emerald-400"
                      }`}
                  >
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500"></span>
                    Low
                  </button>
                </div>
              </div>
              <div className="flex items-center">
                <div className="text-xs sm:text-sm text-gray-600 font-medium">
                  Showing <span className="text-gray-900 font-bold">{fullyFiltered.length}</span> ticket{fullyFiltered.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tickets grid */}
        <div ref={ticketListRef} className="grid grid-cols-1 gap-4 sm:gap-6">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" onClick={() => setShowSubCategoryModal(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative max-w-2xl w-full rounded-xl sm:rounded-2xl shadow-2xl bg-gradient-to-br from-gray-800 to-gray-900 max-h-[90vh] overflow-hidden flex flex-col"
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
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${filters.subCategory === sub.name
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
                      setShowSubCategoriesSection(true); // Show subcategories section
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

// Default export - wraps DashboardContent in Suspense for useSearchParams
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}
