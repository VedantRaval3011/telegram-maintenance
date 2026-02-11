"use client";
import React, { Suspense, useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import Navbar from "@/components/Navbar";
import FilterBar from "@/components/FilterBar";
import SyncUsersButton from "@/components/SyncUsersButton";
import TicketCard from "@/components/TicketCard";
import Capsule from "@/components/Capsule";
import SharePendingWorkModal from "@/components/SharePendingWorkModal";
import { useAuth } from "@/contexts/AuthContext";
import { 
  BarChart3, Info, Activity, CheckCircle2, Share2, X, 
  Camera, Video, FileText, Trash2, Download, Plus, Upload, Loader2, Link
} from "lucide-react";

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
  const { isReadOnly, hideTimeDetails } = useAuth();
  const { data, error, mutate } = useSWR("/api/tickets", fetcher, { refreshInterval: 3000 });
  const { data: usersData } = useSWR("/api/masters/users?limit=100", fetcher);
  const { data: categoriesData } = useSWR("/api/masters/categories?limit=100", fetcher);
  const { data: subCategoriesData } = useSWR("/api/masters/subcategories?limit=100", fetcher);
  const { data: agenciesData } = useSWR("/api/masters/agencies?limit=100", fetcher);
  const { data: locationsData } = useSWR("/api/masters/locations?limit=500", fetcher);
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
  const [shareModalAgency, setShareModalAgency] = useState<{ name: string; id: string } | null>(null); // Track which agency's share modal is open
  // State for ticket editing
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editFormData, setEditFormData] = useState({
    category: '',
    subCategory: '',
    location: '',
    agencyName: '',
    agencyDate: '',
    agencyTime: '',
    priority: '',
    status: '',
    description: '',
    photos: [] as string[],
    videos: [] as string[],
    documents: [] as string[],
  });

  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const [showCategoryAudit, setShowCategoryAudit] = useState(false);
  const [auditCategoryData, setAuditCategoryData] = useState<any>(null);

  const [initialAgencyName, setInitialAgencyName] = useState<string>('');
  const [showSearch, setShowSearch] = useState(false);

  // Global state for excluded tickets from summary (persisted in localStorage)
  const [excludedTicketIds, setExcludedTicketIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('excludedTicketIds');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    }
    return new Set();
  });

  // Sync excluded tickets to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('excludedTicketIds', JSON.stringify(Array.from(excludedTicketIds)));
    }
  }, [excludedTicketIds]);

  // Toggle ticket exclusion from summary calculations
  const toggleExcludeTicket = (ticketId: string) => {
    setExcludedTicketIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId);
      } else {
        newSet.add(ticketId);
      }
      return newSet;
    });
  };


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
    reopenedOnly: false,
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
      reopenedOnly: false,
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

  // Auto-show search field when there's an active search query
  useEffect(() => {
    if (filters.name && !showSearch) {
      setShowSearch(true);
    }
  }, [filters.name, showSearch]);

  // Initialize filters from URL parameters (e.g., when navigating from summary page)
  useEffect(() => {
    // Only run if we have category data and haven't initialized yet
    if (!filtersInitialized && categoriesData?.data && Array.isArray(categoriesData.data)) {
      const category = searchParams.get('category');
      const priority = searchParams.get('priority');
      const status = searchParams.get('status');
      const name = searchParams.get('name');

      if (category || priority || status || name) {
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
          } else {
            setShowCompleted(false);
          }
        }

        if (name) {
          newFilters.name = name;
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

  // Sync edit form data when selected ticket changes or list updates
  useEffect(() => {
    if (!selectedTicketId || !tickets || tickets.length === 0) return;
    
    const ticket = tickets.find((t: any) => t.ticketId === selectedTicketId);
    if (ticket) {
      console.log(`Syncing form for ${selectedTicketId}`, { 
        photos: ticket.photos?.length, 
        docs: ticket.documents?.length 
      });
      
      setEditFormData({
        category: ticket.category || '',
        subCategory: ticket.subCategory || '',
        location: ticket.location || '',
        agencyName: ticket.agencyName || '',
        agencyDate: ticket.agencyDate ? new Date(ticket.agencyDate).toISOString().split('T')[0] : '',
        agencyTime: ticket.agencyTime || '',
        priority: (ticket.priority || 'medium').toLowerCase(),
        status: ticket.status || 'PENDING',
        description: ticket.description || '',
        photos: ticket.photos || [],
        videos: ticket.videos || [],
        documents: ticket.documents || [],
      });
      setInitialAgencyName(ticket.agencyName || '');
    }
  }, [selectedTicketId, tickets]); // Sync whenever selection or the data list changes

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photos' | 'videos' | 'documents') => {
    if (!selectedTicketId) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    setUploadProgress(`Uploading ${files.length} file(s)...`);

    try {
      const formData = new FormData();
      formData.append("ticketId", selectedTicketId);
      formData.append("mediaField", type);
      formData.append("uploadedBy", "Dashboard Admin");
      Array.from(files).forEach(file => {
        formData.append("files", file);
      });

      const response = await fetch("/api/tickets/upload-media", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Upload failed");
      }

      const result = await response.json();
      
      // Update local state to reflect new URLs immediately
      setEditFormData(prev => ({
        ...prev,
        [type]: [...(prev[type as keyof typeof editFormData] as string[]), ...result.data.urls]
      }));

      // Refresh data
      await mutate();
      setUploadProgress("Upload complete!");
      setTimeout(() => setUploadProgress(null), 3000);
    } catch (err: any) {
      console.error(err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploadingFiles(false);
    }
  };

  const removeAttachment = (url: string, type: 'photos' | 'videos' | 'documents') => {
    setEditFormData(prev => ({
      ...prev,
      [type]: (prev[type as keyof typeof editFormData] as string[]).filter(u => u !== url)
    }));
  };

  // Helper to calculate stats
  const calculateStats = useCallback((subset: any[]) => {
    const total = subset.length;
    const priority = {
      high: subset.filter((t: any) => (t.priority || "").toLowerCase() === "high").length,
      medium: subset.filter((t: any) => (t.priority || "").toLowerCase() === "medium").length,
      low: subset.filter((t: any) => (t.priority || "").toLowerCase() === "low").length,
    };

    // Source calculation based on ticket's assigned agency
    let inHouse = 0;
    let outsource = 0;

    subset.forEach((t: any) => {
      const agencyName = (t.agencyName || "").toString().trim();
      // Ticket is outsourced if it has a valid agency name
      if (agencyName && !["NONE", "__NONE__", ""].includes(agencyName.toUpperCase())) {
        outsource++;
      } else {
        inHouse++;
      }
    });

    return { total, priority, source: { inHouse, outsource } };
  }, []);

  // Helper to get audit summary for a category or group
  const getAuditSummary = (subset: any[]) => {
    const pending = subset.filter((t: any) => t.status === "PENDING").length;
    const completed = subset.filter((t: any) => t.status === "COMPLETED").length;
    const total = subset.length;
    
    // Priority breakdown for pending
    const pendingHigh = subset.filter((t: any) => t.status === "PENDING" && (t.priority || "").toLowerCase() === "high").length;
    const pendingMedium = subset.filter((t: any) => t.status === "PENDING" && (t.priority || "").toLowerCase() === "medium").length;
    const pendingLow = subset.filter((t: any) => t.status === "PENDING" && (t.priority || "").toLowerCase() === "low").length;

    // Last activity
    const lastCreated = subset.length > 0 ? new Date(Math.max(...subset.map((t: any) => new Date(t.createdAt).getTime()))).toLocaleDateString() : "Never";
    const lastCompleted = subset.filter(t => t.status === "COMPLETED").length > 0 
      ? new Date(Math.max(...subset.filter((t: any) => t.status === "COMPLETED").map((t: any) => new Date(t.completedAt).getTime()))).toLocaleDateString()
      : "None";

    return { total, pending, completed, pendingHigh, pendingMedium, pendingLow, lastCreated, lastCompleted };
  };

  // Filter logic split into base (global filters) and full (including category/sub selection)
  const baseFiltered = useMemo(() => {
    const {
      location, status, priority, user, name,
      dateFrom, dateTo, timeFrom, timeTo, reopenedOnly
    } = filters;

    let out = tickets.slice();

    if (reopenedOnly) {
      // Show only tickets that have been reopened AND are currently PENDING
      out = out.filter((t: any) => 
        (t.reopenedHistory?.length || 0) > 0 && 
        (t.status || "").toString().toLowerCase() === "pending"
      );
    }

    // Apply showCompleted filter - but bypass if reopenedOnly is true since we already filtered above
    if (!reopenedOnly) {
      if (showCompleted) {
        out = out.filter((t: any) => (t.status || "").toString().toLowerCase() === "completed");
      } else {
        out = out.filter((t: any) => (t.status || "").toString().toLowerCase() === "pending");
      }
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
      const q = name.toLowerCase().trim();
      out = out.filter((t: any) => {
        // Search across all relevant fields
        const ticketId = (t.ticketId || "").toString().toLowerCase();
        const createdBy = (t.createdBy || "").toString().toLowerCase();
        const description = (t.description || "").toString().toLowerCase();
        const category = (t.category || "").toString().toLowerCase();
        const subCategory = (t.subCategory || "").toString().toLowerCase();
        const location = (t.location || "").toString().toLowerCase();
        const agencyName = (t.agencyName || "").toString().toLowerCase();
        const priority = (t.priority || "").toString().toLowerCase();
        const status = (t.status || "").toString().toLowerCase();
        
        // Support multi-keyword search (e.g., "electrical high" or "T5 plumbing")
        const keywords = q.split(/\s+/).filter(k => k.length > 0);
        
        // Check if all keywords match at least one field (AND logic for multiple keywords)
        return keywords.every(keyword => 
          ticketId.includes(keyword) ||
          createdBy.includes(keyword) ||
          description.includes(keyword) ||
          category.includes(keyword) ||
          subCategory.includes(keyword) ||
          location.includes(keyword) ||
          agencyName.includes(keyword) ||
          priority.includes(keyword) ||
          status.includes(keyword)
        );
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

  // Create ticket-to-agency mapping to prevent duplicate counting
  // Each ticket is assigned to exactly ONE agency
  const ticketToAgencyMap = useMemo(() => {
    const map = new Map<string, string>(); // ticketId -> agencyId
    
    // Pass: assign tickets that have explicit agencyName
    categoryStatsBase.forEach((ticket: any) => {
      const ticketId = ticket._id || ticket.ticketId;
      if (ticket.agencyName && !["NONE", "__NONE__"].includes(ticket.agencyName)) {
        const agency = agencies.find((a: any) => 
          a.name.toLowerCase().trim() === (ticket.agencyName || "").toLowerCase().trim()
        );
        if (agency) {
          map.set(ticketId, agency._id);
        } else {
          map.set(ticketId, "none");
        }
      } else {
        map.set(ticketId, "none");
      }
    });
    
    return map;
  }, [categoryStatsBase, agencies, subCategories]);


  const fullyFiltered = useMemo(() => {
    let out = baseFiltered.slice();
    const { category, subCategory, agency, sortBy } = filters;

    if (category) out = out.filter((t: any) => (t.category || "").toString().toLowerCase() === category.toLowerCase());
    if (subCategory) out = out.filter((t: any) => (t.subCategory || "").toString().toLowerCase() === subCategory.toLowerCase());

    // Filter by agency - use the ticket-to-agency mapping to ensure consistency with stats
    if (agency) {
      out = out.filter((t: any) => {
        const ticketId = t._id || t.ticketId;
        return ticketToAgencyMap.get(ticketId) === agency;
      });
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
  }, [baseFiltered, filters, agencies, subCategories, ticketToAgencyMap]);

  // Hierarchical locations for dropdown
  const hierarchicalLocations = useMemo(() => {
    const raw = locationsData?.data || [];
    if (!raw.length) return [];

    const map = new Map<string, any[]>();
    raw.forEach((loc: any) => {
      const parentVal = loc.parentLocationId?._id || loc.parentLocationId;
      const parentId = parentVal ? parentVal.toString() : "root";
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId)!.push(loc);
    });

    const result: { name: string; fullPath: string; depth: number }[] = [];
    const getDepth = (loc: any) => {
      let depth = 0;
      let current = loc;
      // Safety limit to prevent infinite loops in circular hierarchies
      let safetyCounter = 0;
      while (current?.parentLocationId && safetyCounter < 10) {
        safetyCounter++;
        depth++;
        const pId = (current.parentLocationId?._id || current.parentLocationId).toString();
        current = raw.find((x: any) => (x._id?.$oid || x._id || "").toString() === pId);
        if (!current) break;
      }
      return depth;
    };

    const traverse = (parentId: string, currentPath: string[]) => {
      const children = map.get(parentId) || [];
      children.sort((a, b) => a.name.localeCompare(b.name));
      children.forEach((child) => {
        const newPath = [...currentPath, child.name];
        result.push({
          name: child.name,
          fullPath: newPath.join(" → "),
          depth: getDepth(child)
        });
        traverse((child._id?.$oid || child._id || "").toString(), newPath);
      });
    };
    traverse("root", []);
    return result;
  }, [locationsData]);

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

    // Agency Stats - use the shared ticket-to-agency mapping to prevent duplicate counting
    const agencyStats = agencies.map((agency: any) => {
      const agencyTickets = categoryStatsBase.filter((t: any) => {
        const ticketId = t._id || t.ticketId;
        return ticketToAgencyMap.get(ticketId) === agency._id;
      });

      return {
        id: agency._id,
        name: agency.name,
        stats: calculateStats(agencyTickets),
      };
    }).filter((a: any) => a.stats.total > 0); // Only show agencies with pending work


    // Reopened Stats - only count tickets that have been reopened AND are currently PENDING
    const reopenedStats = calculateStats(
      globalStatsBase.filter((t: any) => 
        (t.reopenedHistory?.length || 0) > 0 && 
        t.status === "PENDING"
      )
    );

    return { totalStats, pendingStats, completedStats, reopenedStats, categoryStats, userStats, subCategoryStats, agencyStats };
  }, [fullyFiltered, baseFiltered, categoryStatsBase, globalStatsBase, categories, users, subCategories, selectedCategory, calculateStats, agencies, ticketToAgencyMap]);

  if (error)
    return <div className="p-10 text-center text-red-500">Failed to load</div>;
  if (!data)
    return <div className="p-10 text-center text-gray-500 animate-pulse">Loading…</div>;

  return (
    <>
    <div className="min-h-screen bg-gray-50 pb-16 sm:pb-20">
      <Navbar />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 dashboard-content">
        {/* Top Filters: Advanced Toggle */}
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 mb-3 sm:mb-6">
          {/* Search Icon Button */}
          <button
            onClick={() => {
              setShowSearch(!showSearch);
              if (showSearch) {
                // Clear search when closing
                setFilters({ name: "" });
              }
            }}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm sm:text-base font-medium transition-all border shadow-sm ${
              showSearch || filters.name
                ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
            title="Search tickets"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="hidden sm:inline">Search</span>
            {filters.name && (
              <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs font-bold">
                {fullyFiltered.length}
              </span>
            )}
          </button>
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
            <div id="pending-capsule">
              <Capsule
                title="Pending"
                {...stats.pendingStats}
                onAuditClick={() => {
                  const pendingTickets = globalStatsBase.filter((t: any) => t.status === "PENDING");
                  setAuditCategoryData({ name: "Pending Work", ...getAuditSummary(pendingTickets), color: "#3b82f6" });
                  setShowCategoryAudit(true);
                }}
                onClick={() => {
                  setFilters({ status: "PENDING", reopenedOnly: false, priority: "" });
                  setShowCompleted(false);
                  scrollToTicketList();
                }}
                onPriorityClick={(p) => {
                  setFilters({ priority: p, status: "PENDING", reopenedOnly: false });
                  setShowCompleted(false);
                  scrollToTicketList();
                }}
                selectedPriority={!filters.reopenedOnly && !showCompleted ? filters.priority : ""}
                color="#3b82f6"
                className={!showCompleted && !filters.reopenedOnly ? "ring-2 ring-blue-500 ring-offset-2" : "opacity-70 hover:opacity-100"}
              />
            </div>

            <div id="completed-capsule">
              <Capsule
                title="Completed"
                {...stats.completedStats}
                onAuditClick={() => {
                  const completedTickets = globalStatsBase.filter((t: any) => t.status === "COMPLETED");
                  setAuditCategoryData({ name: "Completed Work", ...getAuditSummary(completedTickets), color: "#10b981" });
                  setShowCategoryAudit(true);
                }}
                onClick={() => {
                  setFilters({ status: "COMPLETED", reopenedOnly: false, priority: "" });
                  setShowCompleted(true);
                  scrollToTicketList();
                }}
                onPriorityClick={(p) => {
                  setFilters({ priority: p, status: "COMPLETED", reopenedOnly: false });
                  setShowCompleted(true);
                  scrollToTicketList();
                }}
                selectedPriority={showCompleted && !filters.reopenedOnly ? filters.priority : ""}
                color="#10b981"
                className={showCompleted && !filters.reopenedOnly ? "ring-2 ring-emerald-500 ring-offset-2" : "opacity-70 hover:opacity-100"}
              />
            </div>

            <div id="reopened-capsule">
              <Capsule
                title="Reopened"
                {...stats.reopenedStats}
                onAuditClick={() => {
                  const reopenedTickets = globalStatsBase.filter((t: any) => 
                    t.reopenedHistory && 
                    t.reopenedHistory.length > 0 && 
                    t.status === "PENDING"
                  );
                  setAuditCategoryData({ name: "Reopened Tickets", ...getAuditSummary(reopenedTickets), color: "#f59e0b" });
                  setShowCategoryAudit(true);
                }}
                onClick={() => {
                  setFilters({ reopenedOnly: true, priority: "" });
                  scrollToTicketList();
                }}
                onPriorityClick={(p) => {
                  setFilters({ priority: p, reopenedOnly: true });
                  scrollToTicketList();
                }}
                selectedPriority={filters.reopenedOnly ? filters.priority : ""}
                color="#f59e0b"
                className={filters.reopenedOnly ? "ring-2 ring-amber-500 ring-offset-2" : "opacity-70 hover:opacity-100"}
              />
            </div>
          </div>
        </div>

        {/* Category Stats Capsules */}
        {stats.categoryStats.length > 0 && (
          <div className="mb-6 sm:mb-12">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-6">By Category</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {stats.categoryStats.map((cat: any) => (
                <div key={cat.id} className="relative" id={`category-${cat.id}`}>
                  <Capsule
                    title={cat.name}
                    {...cat.stats}
                    color={cat.color}
                    selectedPriority={filters.priority}
                    onAuditClick={() => {
                      const catTickets = globalStatsBase.filter((t: any) => (t.category || "").toLowerCase() === cat.internalName.toLowerCase());
                      setAuditCategoryData({
                        name: cat.name,
                        ...getAuditSummary(catTickets),
                        color: cat.color
                      });
                      setShowCategoryAudit(true);
                    }}
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




        {/* Agency Stats Capsules - Agency-wise Pending Work (Collapsible) - Only show for pending view */}
        {!showCompleted && stats.agencyStats && stats.agencyStats.length > 0 && (
          <div className="mb-6 sm:mb-12">
            {/* Collapsible Header */}
            <div
              className="flex items-center justify-between mb-3 sm:mb-6 cursor-pointer group"
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
                  <div key={agency.id} className="relative" id={`agency-${agency.id}`}>
                    <Capsule
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
                          // Save reference to clicked element
                          const clickedDiv = document.getElementById(`agency-${agency.id}`);
                          if (clickedDiv) {
                            clickedElementRef.current = clickedDiv;
                          }

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
                    onScrollBack={scrollBackToTop}
                  />
                    {/* Share Button - Top Right */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent capsule click
                        setShareModalAgency({ name: agency.name, id: agency.id });
                      }}
                      className="absolute top-2 right-2 p-1.5 sm:p-2 bg-white/90 hover:bg-amber-100 rounded-full shadow-md border border-gray-200 transition-all hover:scale-110 group z-10"
                      title="Share Pending Work"
                    >
                      <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
                      {/* Tooltip */}
                      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Share Pending Work
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}




        {/* Priority Filter Section */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-6">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
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
                {/* Sort Dropdown */}
                <div className="flex items-center gap-2">
                  <label htmlFor="sort-select" className="text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wide whitespace-nowrap">
                    Sort:
                  </label>
                  <select
                    id="sort-select"
                    value={filters.sortBy}
                    onChange={(e) => setFilters({ sortBy: e.target.value })}
                    className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium bg-white border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-gray-400"
                  >
                    <option value="">Default</option>
                    <option value="created_desc">Newest First</option>
                    <option value="created_asc">Oldest First</option>
                  </select>
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

        {/* Inline Search Field */}
        {showSearch && (
          <div className="mb-4 sm:mb-6 animate-in slide-in-from-top duration-200">
            <div className="bg-white rounded-lg shadow-sm border-2 border-blue-500 p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={filters.name}
                  onChange={(e) => setFilters({ name: e.target.value })}
                  placeholder="Search: ticket #, description, category, agency, location, priority..."
                  className="flex-1 text-sm sm:text-base text-gray-900 placeholder-gray-400 outline-none bg-transparent"
                  autoFocus
                />
                {filters.name && (
                  <button
                    onClick={() => setFilters({ name: "" })}
                    className="flex-shrink-0 p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                    title="Clear search"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {filters.name && (
                <div className="mt-2 flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-gray-600">
                    <span className="font-semibold text-blue-600">{fullyFiltered.length}</span> result{fullyFiltered.length !== 1 ? 's' : ''} found
                  </span>
                  <span className="text-gray-500">
                    💡 Use multiple keywords (e.g., "T5 electrical")
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tickets grid */}
        <div ref={ticketListRef} className="grid grid-cols-1 gap-3 sm:gap-6">
          {fullyFiltered.map((t: any) => {
            const cat = categories.find((c: any) => c.name.toLowerCase() === (t.category || "").toLowerCase());
            
            // Use explicit agencyName if set (including placeholders like __NONE__ or NONE)
            const displayAgencyName = t.agencyName || null;
            
            return (
              <TicketCard
                key={t.ticketId}
                ticket={{
                  ...t,
                  agencyName: displayAgencyName // Override with derived agency name
                }}
                onStatusChange={() => mutate()}
                categoryColor={cat?.color}
                onScrollBack={scrollBackToTop}
                onEditClick={() => {
                  setSelectedTicketId(t.ticketId);
                  setIsEditMode(true);
                }}
                onExcludeFromSummary={() => toggleExcludeTicket(t.ticketId)}
                isExcludedFromSummary={excludedTicketIds.has(t.ticketId)}
                isReadOnly={isReadOnly}
                hideTimeDetails={hideTimeDetails}
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

      {/* Edit Ticket Modal */}
      {selectedTicketId && (() => {
        const selectedTicket = tickets.find((t: any) => t.ticketId === selectedTicketId);
        if (!selectedTicket) return null;

        // Get subcategories for selected category
        const selectedCategoryData = categories.find((c: any) => c.name === editFormData.category);
        const availableSubcategories = selectedCategoryData 
          ? subCategories
              .filter((sub: any) => sub.categoryId === selectedCategoryData._id)
              .map((sub: any) => sub.name)
          : [];

        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4" 
            onClick={() => {
              setSelectedTicketId(null);
              setIsEditMode(false);
            }}
          >
            <div className="absolute inset-0 bg-black/60" />
            
            {!isEditMode ? (
              /* Step 1: Preview/Read-Only View */
              <div
                className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <TicketCard
                  ticket={selectedTicket}
                  onStatusChange={() => {
                    mutate();
                  }}
                  categoryColor={
                    categories.find((c: any) => c.name.toLowerCase() === (selectedTicket.category || "").toLowerCase())?.color
                  }
                  onEditClick={() => setIsEditMode(true)}
                  onExcludeFromSummary={() => toggleExcludeTicket(selectedTicket.ticketId)}
                  isExcludedFromSummary={excludedTicketIds.has(selectedTicket.ticketId)}
                  isReadOnly={isReadOnly}
                  hideTimeDetails={hideTimeDetails}
                />
              </div>
            ) : (
              /* Step 2: Full Edit Form */
              <div
                className="relative w-full max-w-4xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-orange-50 via-white to-purple-50 rounded-3xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b-2 border-gray-200 px-8 py-6 rounded-t-3xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-orange-500 to-pink-500 rounded-xl shadow-lg">
                        <BarChart3 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Edit Ticket</h2>
                        <p className="text-sm text-gray-600 mt-1">Ticket ID: {selectedTicket.ticketId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsEditMode(false)}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors flex items-center gap-2"
                        title="Back to Preview"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTicketId(null);
                          setIsEditMode(false);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Form Content */}
                <div className="p-8 space-y-8">
                  {/* Description Section */}
                  <div className="bg-white rounded-2xl p-6 shadow-md border-2 border-orange-200">
                    <label className="block text-sm font-bold text-gray-700 mb-3">
                      Description
                    </label>
                    <textarea
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      className="w-full px-4 py-3 bg-orange-50 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all resize-none"
                      rows={4}
                      placeholder="Enter ticket description..."
                    />
                  </div>

                  {/* Details Section */}
                  <div className="bg-white rounded-2xl p-6 shadow-md border-2 border-blue-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Info className="w-5 h-5 text-blue-600" />
                      Ticket Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Category */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Category
                        </label>
                        <select
                          value={editFormData.category}
                          onChange={(e) => {
                            const newCategory = e.target.value;
                            setEditFormData({
                              ...editFormData,
                              category: newCategory,
                              subCategory: '', // Reset subcategory when category changes
                            });
                          }}
                          className="w-full px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                        >
                          <option value="">Select Category</option>
                          {categories.map((cat: any) => (
                            <option key={cat._id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Subcategory */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Subcategory
                        </label>
                        <select
                          value={editFormData.subCategory}
                          onChange={(e) => {
                            setEditFormData({
                              ...editFormData,
                              subCategory: e.target.value,
                            });
                          }}
                          disabled={!editFormData.category || availableSubcategories.length === 0}
                          className="w-full px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Select Subcategory</option>
                          {availableSubcategories.map((sub: any) => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                      </div>

                      {/* Priority */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Priority
                        </label>
                        <select
                          value={editFormData.priority}
                          onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
                          className="w-full px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                        >
                          <option value="high">🔴 High</option>
                          <option value="medium">🟡 Medium</option>
                          <option value="low">🟢 Low</option>
                        </select>
                      </div>

                      {/* Status */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Status
                        </label>
                        <select
                          value={editFormData.status}
                          onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                          className="w-full px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                        >
                          <option value="PENDING">Pending</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Location & Assignment Section */}
                  <div className="bg-white rounded-2xl p-6 shadow-md border-2 border-purple-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-purple-600" />
                      Location & Assignment
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Location */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Location
                        </label>
                        <select
                          value={editFormData.location}
                          onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                          className="w-full px-4 py-3 bg-purple-50 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium"
                        >
                          <option value="">Select Location</option>
                          {hierarchicalLocations.map((loc, idx) => (
                            <option key={idx} value={loc.fullPath}>
                              {Array(loc.depth).fill("\u00A0\u00A0\u00A0").join("")}
                              {loc.depth > 0 ? "└─ " : ""}
                              {loc.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Agency */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Assigned Agency
                        </label>
                        <select
                          value={editFormData.agencyName}
                          onChange={(e) => setEditFormData({ ...editFormData, agencyName: e.target.value })}
                          className="w-full px-4 py-3 bg-purple-50 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium"
                        >
                          <option value="In-House Team">In-House Team</option>
                          {agencies.map((agency: any) => (
                            <option key={agency._id} value={agency.name}>
                              {agency.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Date & Time Selection (Only if agency changed) */}
                      {editFormData.agencyName !== initialAgencyName && (
                        <>
                          <div className="animate-fadeIn">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Schedule Date
                            </label>
                            <input
                              type="date"
                              value={editFormData.agencyDate}
                              onChange={(e) => setEditFormData({ ...editFormData, agencyDate: e.target.value })}
                              className="w-full px-4 py-3 bg-purple-50 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium"
                            />
                          </div>

                          <div className={`animate-fadeIn transition-opacity duration-300 ${!editFormData.agencyDate ? 'opacity-50' : 'opacity-100'}`}>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Time Slot
                            </label>
                            <select
                              value={editFormData.agencyTime}
                              onChange={(e) => setEditFormData({ ...editFormData, agencyTime: e.target.value })}
                              disabled={!editFormData.agencyDate}
                              className="w-full px-4 py-3 bg-purple-50 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium disabled:cursor-not-allowed"
                            >
                              <option value="">Select Time Slot</option>
                              <option value="First Half">First Half</option>
                              <option value="Second Half">Second Half</option>
                            </select>
                            {!editFormData.agencyDate && (
                              <p className="text-[10px] text-gray-400 mt-1 italic">Please select a date first</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Attachments Section */}
                  <div className="bg-white rounded-2xl p-6 shadow-md border-2 border-green-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Link className="w-5 h-5 text-green-600" />
                        Media & Attachments
                      </h3>
                      {uploadingFiles && (
                        <div className="flex items-center gap-2 text-xs font-bold text-blue-600 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {uploadProgress}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Photos */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold uppercase text-gray-500 flex items-center gap-1">
                            <Camera size={14} /> Photos ({editFormData.photos?.length || 0})
                          </label>
                          <label className="p-1 hover:bg-green-50 rounded cursor-pointer transition-colors text-green-600" title="Upload Photo">
                            <Plus size={16} />
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*" 
                              multiple 
                              onChange={(e) => handleFileUpload(e, 'photos')}
                              disabled={uploadingFiles}
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {editFormData.photos?.map((url, idx) => (
                            <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                              <img src={url} alt="Photo" className="w-full h-full object-cover" />
                              <button 
                                onClick={() => removeAttachment(url, 'photos')}
                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Videos */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold uppercase text-gray-500 flex items-center gap-1">
                            <Video size={14} /> Videos ({editFormData.videos?.length || 0})
                          </label>
                          <label className="p-1 hover:bg-green-50 rounded cursor-pointer transition-colors text-green-600" title="Upload Video">
                            <Plus size={16} />
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="video/*" 
                              onChange={(e) => handleFileUpload(e, 'videos')}
                              disabled={uploadingFiles}
                            />
                          </label>
                        </div>
                        <div className="space-y-2 text-[10px] text-gray-500">
                          {editFormData.videos?.map((url, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                              <span className="truncate flex-1">Video {idx + 1}</span>
                              <button 
                                onClick={() => removeAttachment(url, 'videos')}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Documents */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold uppercase text-gray-500 flex items-center gap-1">
                            <FileText size={14} /> Documents ({editFormData.documents?.length || 0})
                          </label>
                          <label className="p-1 hover:bg-green-50 rounded cursor-pointer transition-colors text-green-600" title="Upload Document">
                            <Plus size={16} />
                            <input 
                              type="file" 
                              className="hidden" 
                              accept=".pdf,.xlsx,.xls,.docx,.doc,.txt" 
                              multiple 
                              onChange={(e) => handleFileUpload(e, 'documents')}
                              disabled={uploadingFiles}
                            />
                          </label>
                        </div>
                        <div className="space-y-2">
                          {editFormData.documents?.map((url, idx) => {
                            const name = url.split('/').pop()?.split('_').pop() || `Doc ${idx + 1}`;
                            return (
                              <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 text-xs">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <FileText size={12} className="text-gray-400" />
                                  <span className="truncate text-gray-700">{name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 p-1">
                                    <Download size={12} />
                                  </a>
                                  <button 
                                    onClick={() => removeAttachment(url, 'documents')}
                                    className="text-red-500 hover:text-red-700 p-1"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes Section */}
                  <div className="bg-white rounded-2xl p-6 shadow-md border-2 border-indigo-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Notes
                    </h3>
                    <div className="space-y-3">
                      {(selectedTicket as any).notes && (selectedTicket as any).notes.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {(selectedTicket as any).notes.map((note: any, index: number) => (
                            <div key={index} className="p-4 bg-indigo-50 border-2 border-indigo-200 rounded-xl">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-indigo-900">{note.addedBy || 'Unknown'}</span>
                                <span className="text-xs text-indigo-600">
                                  {note.timestamp ? new Date(note.timestamp).toLocaleString() : 'No date'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700">{note.content}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic py-4 text-center">No notes yet</p>
                      )}
                      <div className="pt-3 border-t-2 border-indigo-200">
                        <textarea
                          className="w-full px-4 py-3 bg-indigo-50 border-2 border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                          rows={3}
                          placeholder="Add a new note..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t-2 border-gray-200 px-8 py-6 rounded-b-3xl">
                  <div className="flex items-center justify-end gap-4">
                    <button
                      onClick={() => setIsEditMode(false)}
                      className="px-8 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          // Collect form data
                            const updateData: any = {
                              description: editFormData.description,
                              category: editFormData.category,
                              subCategory: editFormData.subCategory,
                              priority: editFormData.priority,
                              status: editFormData.status,
                              location: editFormData.location,
                              agencyName: editFormData.agencyName,
                              agencyDate: editFormData.agencyDate || null,
                              agencyTime: editFormData.agencyTime || null,
                              photos: editFormData.photos,
                              videos: editFormData.videos,
                              documents: editFormData.documents,
                            };
                            
                            const newNoteEl = document.querySelector('textarea[placeholder="Add a new note..."]') as HTMLTextAreaElement;

                            // Send PATCH request to update ticket
                            const response = await fetch(`/api/tickets/${selectedTicket.ticketId}`, {
                              method: 'PATCH',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify(updateData),
                            });

                            if (!response.ok) {
                              throw new Error('Failed to update ticket');
                            }

                            // Success - refresh data and close modal
                            await mutate();
                            setSelectedTicketId(null);
                            setIsEditMode(false);
                            
                            // Show success message
                            alert('Ticket updated successfully!');
                        } catch (error) {
                          console.error('Error updating ticket:', error);
                          alert('Failed to update ticket. Please try again.');
                        }
                      }}
                      className="px-8 py-3 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
    
    {/* Share Pending Work Modal */}
    <SharePendingWorkModal
      isOpen={!!shareModalAgency}
      onClose={() => setShareModalAgency(null)}
      agencyName={shareModalAgency?.name || ""}
      tickets={tickets}
    />
      {/* Category Audit Summary Modal */}
      {showCategoryAudit && auditCategoryData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6" onClick={() => setShowCategoryAudit(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative max-w-md w-full rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: `${auditCategoryData.color}15`, borderBottom: `1px solid ${auditCategoryData.color}30` }}>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${auditCategoryData.color}20` }}>
                  <Activity size={20} style={{ color: auditCategoryData.color }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-none text-gray-900">{auditCategoryData.name}</h2>
                  <p className="text-[10px] font-semibold mt-1 uppercase tracking-wider text-gray-500">Aggregate Summary</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCategoryAudit(false)}
                className="p-2 rounded-full hover:bg-black/5 transition-colors text-gray-500"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Main Breakdown */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase text-gray-400 mb-1">Total</p>
                  <p className="text-2xl font-black text-gray-900">{auditCategoryData.total}</p>
                </div>
                <div className="h-10 w-px bg-gray-200" />
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase text-teal-500 mb-1">Completed</p>
                  <p className="text-2xl font-black text-teal-600">{auditCategoryData.completed}</p>
                </div>
                <div className="h-10 w-px bg-gray-200" />
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase text-amber-500 mb-1">Pending</p>
                  <p className="text-2xl font-black text-amber-600">{auditCategoryData.pending}</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-gray-600">
                  <span>Completion Progress</span>
                  <span>{auditCategoryData.total > 0 ? Math.round((auditCategoryData.completed / auditCategoryData.total) * 100) : 0}%</span>
                </div>
                <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                  <div 
                    className="h-full transition-all duration-1000 ease-out"
                    style={{ 
                      width: `${auditCategoryData.total > 0 ? (auditCategoryData.completed / auditCategoryData.total) * 100 : 0}%`,
                      backgroundColor: auditCategoryData.color || '#14b8a6'
                    }}
                  />
                </div>
              </div>

              {/* Pending Priority Breakdown */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Pending by Priority</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-100 text-center">
                    <p className="text-[10px] font-bold text-rose-600 uppercase">High</p>
                    <p className="text-lg font-black text-rose-700">{auditCategoryData.pendingHigh}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-100 text-center">
                    <p className="text-[10px] font-bold text-amber-600 uppercase">Med</p>
                    <p className="text-lg font-black text-amber-700">{auditCategoryData.pendingMedium}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-center">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase">Low</p>
                    <p className="text-lg font-black text-emerald-700">{auditCategoryData.pendingLow}</p>
                  </div>
                </div>
              </div>

              {/* Activity Info */}
              <div className="pt-4 border-t border-dashed border-gray-200 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Last Entry</p>
                  <p className="text-xs font-semibold text-gray-700">{auditCategoryData.lastCreated}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Last Fix</p>
                  <p className="text-xs font-semibold text-gray-700">{auditCategoryData.lastCompleted}</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 flex items-center justify-end border-t border-gray-100">
              <button
                onClick={() => setShowCategoryAudit(false)}
                className="px-6 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 shadow-md"
                style={{ backgroundColor: auditCategoryData.color || '#1f2937' }}
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
