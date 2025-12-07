"use client";
import React, { useMemo, useState, useCallback } from "react";
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [filters, setFiltersState] = useState({
    category: "",
    subCategory: "",
    location: "",
    status: "PENDING", // Default to PENDING
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
      status: "PENDING",
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

  const tickets = data && Array.isArray(data.data) ? data.data : [];
  const users = usersData?.data || [];
  const categories = categoriesData?.data || [];
  const subCategories = subCategoriesData?.data || [];

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

    if (location) out = out.filter((t: any) => (t.location || "").toString().toLowerCase() === location.toLowerCase());
    if (status) out = out.filter((t: any) => (t.status || "").toString().toLowerCase() === status.toLowerCase());
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
    // But we prepend "All Categories"
    const allCategoriesStat = {
      id: "all",
      name: "All Categories",
      stats: calculateStats(baseFiltered), // baseFiltered respects Status & Priority, but not Category
    };

    const specificCategoryStats = categories.map((cat: any) => {
      const catTickets = baseFiltered.filter((t: any) => (t.category || "").toLowerCase() === cat.name.toLowerCase());
      return {
        id: cat._id,
        name: cat.displayName,
        stats: calculateStats(catTickets),
        color: cat.color,
      };
    }).filter((c: any) => c.stats.total > 0);

    const categoryStats = [allCategoriesStat, ...specificCategoryStats];

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
    <div className="min-h-screen bg-white pb-20">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Capsule
              title="Total Tickets"
              {...stats.totalStats}
              onClick={() => setFilters({ status: "" })}
              onPriorityClick={(p) => setFilters({ priority: p })}
              selectedPriority={filters.priority}
              color="#ec4899"
              className={filters.status === "" ? "ring-2 ring-gray-900 ring-offset-2" : ""}
            />
            <Capsule
              title="Pending"
              {...stats.pendingStats}
              onClick={() => setFilters({ status: "PENDING" })}
              onPriorityClick={(p) => setFilters({ priority: p })}
              selectedPriority={filters.priority}
              color="#3b82f6"
              className={filters.status === "PENDING" ? "ring-2 ring-gray-900 ring-offset-2" : ""}
            />
            <Capsule
              title="Completed"
              {...stats.completedStats}
              onClick={() => setFilters({ status: "COMPLETED" })}
              onPriorityClick={(p) => setFilters({ priority: p })}
              selectedPriority={filters.priority}
              color="#14b8a6"
              className={filters.status === "COMPLETED" ? "ring-2 ring-gray-900 ring-offset-2" : ""}
            />
          </div>
        </div>

        {/* Category Stats Capsules */}
        {stats.categoryStats.length > 0 && (
          <div className="mb-12">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">By Category</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats.categoryStats.map((cat: any) => (
                <div key={cat.id} className="relative">
                  <Capsule
                    title={cat.name}
                    {...cat.stats}
                    onClick={() => {
                      const isAll = cat.id === "all";
                      setFilters({ category: isAll ? "" : cat.name });
                      setSelectedCategory(isAll ? null : cat.id);
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
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-sm text-gray-600 hover:text-gray-900 underline font-medium"
              >
                Close
              </button>
            </div>

            {stats.subCategoryStats.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stats.subCategoryStats.map((sub: any) => (
                  <Capsule
                    key={sub.id}
                    title={sub.name}
                    {...sub.stats}
                    onClick={() => {
                      // Filter by this subcategory
                      const cat = categories.find((c: any) => c._id === selectedCategory);
                      setFilters({
                        category: cat ? cat.name : "",
                        subCategory: sub.name
                      });
                    }}
                    className={filters.subCategory === sub.name ? "ring-2 ring-gray-900 ring-offset-2" : ""}
                    onPriorityClick={(p) => setFilters({ priority: p })}
                    selectedPriority={filters.priority}
                    color={categories.find((c: any) => c._id === selectedCategory)?.color || "#6b7280"}
                  />
                ))}
              </div>
            ) : (
              <div className="text-gray-500 italic px-4">No tickets found for subcategories in this category.</div>
            )}
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



        {/* Tickets grid */}
        <div className="grid grid-cols-1 gap-6">
          {fullyFiltered.map((t: any) => {
            const cat = categories.find((c: any) => c.name.toLowerCase() === (t.category || "").toLowerCase());
            return (
              <TicketCard
                key={t.ticketId}
                ticket={t}
                onStatusChange={() => mutate()}
                categoryColor={cat?.color}
              />
            );
          })}
        </div>

        {fullyFiltered.length === 0 && (
          <div className="mt-6 text-center text-gray-500">No tickets match the current filters.</div>
        )}
      </div>
    </div>
  );
}
