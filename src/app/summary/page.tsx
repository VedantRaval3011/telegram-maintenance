"use client";
import React, { useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Capsule from "@/components/Capsule";
import TicketCard from "@/components/TicketCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart,
  AreaChart,
  Area,
  ReferenceLine,
} from "recharts";
import { Clock, TrendingUp, CheckCircle2, BarChart3, PieChart as PieChartIcon, Info, Activity, ChevronDown, Users, Building2 } from "lucide-react";

const fetcher = (url: string) =>
  fetch(url)
    .then((res) => res.json())
    .then((json) => json.data || []);

interface Ticket {
  _id: string;
  ticketId: string;
  description: string;
  category: string | null;
  subCategory?: string | null;
  priority: "low" | "medium" | "high";
  location?: string | null;
  status: "PENDING" | "COMPLETED";
  createdBy?: string | null;
  createdAt: string;
  completedBy?: string | null;
  completedAt?: string | null;
  agencyName?: string | null;
}

interface CategorySummary {
  category: string;
  displayName: string;
  totalCompleted: number;
  averageTimeHours: number;
  color: string;
  priority: {
    high: number;
    medium: number;
    low: number;
  };
  source: {
    inHouse: number;
    outsource: number;
  };
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-bold">{formatter ? formatter(entry.value) : entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Custom Label for Pie Charts
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null; // Don't show label if less than 5%

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="text-xs font-bold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// Custom X-Axis Tick with text wrapping
const CustomXAxisTick = ({ x, y, payload }: any) => {
  const text = payload.value;
  const maxCharsPerLine = 12;

  // Split text into words
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word: string) => {
    if ((currentLine + word).length <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) lines.push(currentLine);

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={32}
        textAnchor="middle"
        fill="#374151"
        fontSize={12}
        fontWeight={500}
      >
        {lines.map((line, index) => (
          <tspan key={index} x={0} dy={index === 0 ? 0 : 18}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
};

export default function SummaryPage() {
  const router = useRouter();
  const { data: tickets = [], error, isLoading, mutate } = useSWR<Ticket[]>("/api/tickets", fetcher, { refreshInterval: 3000 });
  const { data: categoriesData } = useSWR("/api/masters/categories?limit=100", (url: string) =>
    fetch(url).then(r => r.json()));
  const { data: locationsData } = useSWR("/api/masters/locations?limit=100", (url: string) =>
    fetch(url).then(r => r.json()));
  const { data: agenciesData } = useSWR("/api/masters/agencies?limit=100", (url: string) =>
    fetch(url).then(r => r.json()));
  const { data: subCategoriesData } = useSWR("/api/masters/subcategories?limit=100", (url: string) =>
    fetch(url).then(r => r.json()));

  const categories = categoriesData?.data || [];
  const locations = locationsData?.data || [];
  const agencies = agenciesData?.data || [];
  const subCategories = subCategoriesData?.data || [];

  // State for filtering subcategory charts by category
  const [selectedSubCategoryFilter, setSelectedSubCategoryFilter] = useState<string>('all');

  // State for collapsible sections
  const [expandedSections, setExpandedSections] = useState({
    categoryPerformance: false, // Minimized by default
    completionVolume: true,
    avgTimeCategory: true,
    avgTimeSubcategory: true,
  });

  // State for tracking which category cards are expanded
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // State for tracking which agency cards are expanded
  const [expandedAgencies, setExpandedAgencies] = useState<Set<string>>(new Set());

  // State for selected ticket modal and edit mode
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const selectedTicket = Array.isArray(tickets) ? tickets.find((t: any) => t.ticketId === selectedTicketId) : undefined;
  const [editFormData, setEditFormData] = useState({
    category: '',
    subCategory: '',
  });
  
  // State for excluded tickets from summary calculations (persisted in localStorage)
  const [excludedTicketIds, setExcludedTicketIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('excludedTicketIds');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    }
    return new Set();
  });

  // Sync excluded tickets to localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('excludedTicketIds', JSON.stringify(Array.from(excludedTicketIds)));
    }
  }, [excludedTicketIds]);
  
  // State for mobile responsiveness
  const [isMobile, setIsMobile] = useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // State for stable subcategory tooltip
  const [activeTooltip, setActiveTooltip] = useState<{
    data: any;
    pos: { x: number; y: number };
    chartId: string;
  } | null>(null);

  // Sync edit form data when selected ticket changes
  React.useEffect(() => {
    if (selectedTicket) {
      setEditFormData({
        category: selectedTicket.category || '',
        subCategory: selectedTicket.subCategory || '',
      });
    }
  }, [selectedTicket]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

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

  // Calculate time difference in hours
  const calculateTimeDiff = (createdAt: string, completedAt: string): number => {
    const created = new Date(createdAt);
    const completed = new Date(completedAt);
    return (completed.getTime() - created.getTime()) / (1000 * 60 * 60);
  };

  // Format hours to readable format
  const formatTime = (hours: number): string => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    } else if (hours < 24) {
      return `${hours.toFixed(1)}h`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.round(hours % 24);
      return `${days}d ${remainingHours}h`;
    }
  };

  // Calculate summary statistics
  const summary = useMemo(() => {
    if (!Array.isArray(tickets)) return [];

    const completedTickets = tickets.filter(
      (t) => t.status === "COMPLETED" && t.completedAt && t.createdAt && !excludedTicketIds.has(t.ticketId)
    );

    const categoryMap = new Map<string, CategorySummary>();

    completedTickets.forEach((ticket) => {
      const category = ticket.category || "Uncategorized";
      const timeDiff = calculateTimeDiff(ticket.createdAt, ticket.completedAt!);

      if (!categoryMap.has(category)) {
        const categoryData = categories.find((c: any) => c.name === category);
        categoryMap.set(category, {
          category,
          displayName: categoryData?.displayName || category,
          totalCompleted: 0,
          averageTimeHours: 0,
          color: categoryData?.color || "#6b7280",
          priority: { high: 0, medium: 0, low: 0 },
          source: { inHouse: 0, outsource: 0 },
        });
      }

      const catData = categoryMap.get(category)!;
      catData.totalCompleted++;

      // Update priority counts
      if (ticket.priority === "high") catData.priority.high++;
      else if (ticket.priority === "medium") catData.priority.medium++;
      else if (ticket.priority === "low") catData.priority.low++;

      // Update source counts
      if (ticket.agencyName && !["NONE", "__NONE__"].includes(ticket.agencyName)) {
        catData.source.outsource++;
      } else {
        catData.source.inHouse++;
      }

      // Update category average
      catData.averageTimeHours =
        (catData.averageTimeHours * (catData.totalCompleted - 1) + timeDiff) /
        catData.totalCompleted;
    });

    return Array.from(categoryMap.values()).sort((a, b) => b.totalCompleted - a.totalCompleted);
  }, [tickets, categories, excludedTicketIds]);

  // Calculate overall stats
  const overallStats = useMemo(() => {
    if (!Array.isArray(tickets)) {
      return { total: 0, priority: { high: 0, medium: 0, low: 0 }, source: { inHouse: 0, outsource: 0 } };
    }

    const completedTickets = tickets.filter(t => t.status === "COMPLETED" && !excludedTicketIds.has(t.ticketId));
    const totalTimeHours = completedTickets.reduce((acc, t) => acc + calculateTimeDiff(t.createdAt, t.completedAt!), 0);

    return {
      total: completedTickets.length,
      avgTime: completedTickets.length > 0 ? totalTimeHours / completedTickets.length : 0,
      priority: {
        high: completedTickets.filter(t => t.priority === "high").length,
        medium: completedTickets.filter(t => t.priority === "medium").length,
        low: completedTickets.filter(t => t.priority === "low").length,
      },
      source: {
        inHouse: completedTickets.filter(t => !t.agencyName || ["NONE", "__NONE__"].includes(t.agencyName)).length,
        outsource: completedTickets.filter(t => t.agencyName && !["NONE", "__NONE__"].includes(t.agencyName)).length,
      }
    };
  }, [tickets, excludedTicketIds]);

  // Calculate subcategory breakdown for each category (count, avg time, and ticket IDs)
  const subcategoryBreakdown = useMemo(() => {
    if (!Array.isArray(tickets)) return new Map();

    const completedTickets = tickets.filter(
      (t) => t.status === "COMPLETED" && t.completedAt && t.createdAt && !excludedTicketIds.has(t.ticketId)
    );

    // Map: category -> subcategory -> { count, totalTime, avgTime, ticketIds }
    const categorySubMap = new Map<string, Map<string, { count: number; totalTime: number; avgTime: number; ticketIds: string[] }>>();

    completedTickets.forEach((ticket) => {
      const category = ticket.category || "Uncategorized";
      const subCategory = ticket.subCategory || "Others";
      const timeDiff = calculateTimeDiff(ticket.createdAt, ticket.completedAt!);

      if (!categorySubMap.has(category)) {
        categorySubMap.set(category, new Map());
      }

      const subMap = categorySubMap.get(category)!;
      if (!subMap.has(subCategory)) {
        subMap.set(subCategory, { count: 0, totalTime: 0, avgTime: 0, ticketIds: [] });
      }

      const subData = subMap.get(subCategory)!;
      subData.count++;
      subData.totalTime += timeDiff;
      subData.avgTime = subData.totalTime / subData.count;
      subData.ticketIds.push(ticket.ticketId);
    });

    return categorySubMap;
  }, [tickets, excludedTicketIds]);

  // Prepare chart data with subcategory breakdown (for ticket counts)
  const barChartData = summary.map(cat => {
    const subCategoryData = subcategoryBreakdown.get(cat.category) || new Map();
    const subCategoryObj: Record<string, number> = {};

    subCategoryData.forEach((data: { count: number; totalTime: number; avgTime: number }, subCat: string) => {
      subCategoryObj[subCat] = data.count;
    });

    return {
      name: cat.displayName,
      completed: cat.totalCompleted,
      avgTime: parseFloat(cat.averageTimeHours.toFixed(1)),
      color: cat.color,
      ...subCategoryObj, // Spread subcategory counts
    };
  });

  // Prepare subcategory average time data for each category
  const subcategoryAvgTimeData = useMemo(() => {
    const data: { category: string; displayName: string; color: string; subcategories: { name: string; avgTime: number; count: number; ticketIds: string[] }[] }[] = [];

    summary.forEach(cat => {
      const subCategoryData = subcategoryBreakdown.get(cat.category);
      if (subCategoryData && subCategoryData.size > 0) {
        const subcategories = (Array.from(subCategoryData.entries()) as [string, { count: number; totalTime: number; avgTime: number; ticketIds: string[] }][])
          .map(([name, subData]) => ({
            name,
            avgTime: parseFloat(subData.avgTime.toFixed(1)),
            count: subData.count,
            ticketIds: subData.ticketIds,
          }))
          .sort((a, b) => b.avgTime - a.avgTime);

        data.push({
          category: cat.category,
          displayName: cat.displayName,
          color: cat.color,
          subcategories,
        });
      }
    });

    return data;
  }, [summary, subcategoryBreakdown]);

  // Prepare combined subcategories data for "All Categories" view
  const allSubcategoriesCombined = useMemo(() => {
    const combinedMap = new Map<string, { avgTime: number; count: number; ticketIds: string[]; category: string; color: string }>();
    
    subcategoryAvgTimeData.forEach((catData) => {
      catData.subcategories.forEach((sub) => {
        const key = `${sub.name} (${catData.displayName})`;
        combinedMap.set(key, {
          avgTime: sub.avgTime,
          count: sub.count,
          ticketIds: sub.ticketIds,
          category: catData.category,
          color: catData.color,
        });
      });
    });

    return Array.from(combinedMap.entries())
      .map(([name, data]) => ({
        name,
        avgTime: data.avgTime,
        count: data.count,
        ticketIds: data.ticketIds,
        color: data.color,
      }))
      .sort((a, b) => b.avgTime - a.avgTime);
  }, [subcategoryAvgTimeData]);

  // Get all unique subcategories for the legend
  const allSubCategories = useMemo(() => {
    const subCats = new Set<string>();
    subcategoryBreakdown.forEach((subMap: Map<string, { count: number; totalTime: number; avgTime: number }>) => {
      subMap.forEach((_, subCat: string) => {
        subCats.add(subCat);
      });
    });
    return Array.from(subCats).sort();
  }, [subcategoryBreakdown]);

  // Generate colors for subcategories
  const subCategoryColors: Record<string, string> = useMemo(() => {
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
      '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
      '#a855f7', '#22c55e', '#eab308', '#f43f5e', '#6366f1'
    ];
    const colorMap: Record<string, string> = {};
    allSubCategories.forEach((subCat, index) => {
      colorMap[subCat] = colors[index % colors.length];
    });
    return colorMap;
  }, [allSubCategories]);

  // Calculate agency-wise performance data
  const agencyPerformanceData = useMemo(() => {
    if (!Array.isArray(tickets)) return [];

    const completedTickets = tickets.filter(
      (t) => t.status === "COMPLETED" && t.completedAt && t.createdAt
    );

    // Map: agencyName -> { totalTickets, totalTime, avgTime, categories: Map<category, count> }
    const agencyMap = new Map<string, { 
      totalTickets: number; 
      totalTime: number; 
      avgTime: number; 
      categories: Map<string, number>;
      categoryColors: Map<string, string>;
    }>();

    completedTickets.forEach((ticket) => {
      // EXCLUDE tickets without an explicit agency selected
      if (!ticket.agencyName || ["NONE", "__NONE__"].includes(ticket.agencyName)) {
        return; // Skip this ticket for agency analytics
      }

      const agencyName = ticket.agencyName;
      const timeDiff = calculateTimeDiff(ticket.createdAt, ticket.completedAt!);
      const category = ticket.category || "Uncategorized";

      if (!agencyMap.has(agencyName)) {
        agencyMap.set(agencyName, {
          totalTickets: 0,
          totalTime: 0,
          avgTime: 0,
          categories: new Map(),
          categoryColors: new Map(),
        });
      }

      const agencyData = agencyMap.get(agencyName)!;
      agencyData.totalTickets++;
      agencyData.totalTime += timeDiff;
      agencyData.avgTime = agencyData.totalTime / agencyData.totalTickets;

      // Track category breakdown
      const currentCount = agencyData.categories.get(category) || 0;
      agencyData.categories.set(category, currentCount + 1);

      // Store category color
      const categoryData = categories.find((c: any) => c.name === category);
      if (categoryData && !agencyData.categoryColors.has(category)) {
        agencyData.categoryColors.set(category, categoryData.color || "#6b7280");
      }
    });

    // Convert to array and sort by total time consumed (descending)
    return Array.from(agencyMap.entries())
      .map(([name, data]) => ({
        name,
        totalTickets: data.totalTickets,
        totalTime: parseFloat(data.totalTime.toFixed(1)),
        avgTime: parseFloat(data.avgTime.toFixed(1)),
        categories: Array.from(data.categories.entries()).map(([cat, count]) => ({
          category: cat,
          count,
          color: data.categoryColors.get(cat) || "#6b7280",
        })).sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.totalTime - a.totalTime);
  }, [tickets, categories]);

  const pieChartData = summary.map(cat => ({
    name: cat.displayName,
    value: cat.totalCompleted,
    color: cat.color,
  }));

  const priorityData = [
    { name: "High Priority", value: overallStats.priority.high, color: "#ef4444" },
    { name: "Medium Priority", value: overallStats.priority.medium, color: "#eab308" },
    { name: "Low Priority", value: overallStats.priority.low, color: "#10b981" },
  ].filter(d => d.value > 0);

  const sourceData = [
    { name: "In-House Team", value: overallStats.source.inHouse, color: "#3b82f6" },
    { name: "External Agency", value: overallStats.source.outsource, color: "#f59e0b" },
  ].filter(d => d.value > 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="p-10 text-center text-gray-500 animate-pulse">Loading summary...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="p-10 text-center text-red-500">Failed to load</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Work Summary & Analytics</h1>
          <p className="text-sm sm:text-base text-gray-600">
            Comprehensive performance metrics and insights for completed maintenance work
          </p>
        </div>

        {/* Overall Stats Capsule */}
        <div className="mb-8 sm:mb-12">
          <Capsule
            title="Total Completed Work"
            {...overallStats}
            color="#14b8a6"
          />
        </div>

        {/* Enhanced Unified Analytics Overview Chart */}
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-xl sm:shadow-2xl border-2 border-indigo-200 p-4 sm:p-10 mb-8 sm:mb-12">
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg flex-shrink-0">
                  <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Complete Analytics Overview</h3>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    Workload, efficiency, and time benchmarks across all categories
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 bg-gradient-to-r from-teal-50 to-teal-100 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border-2 border-teal-300 shadow-sm">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" />
                  <div className="text-left">
                    <div className="text-[8px] sm:text-[10px] text-teal-600 font-semibold uppercase">Tickets</div>
                    <div className="text-sm sm:text-lg font-bold text-teal-900">{overallStats.total}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-purple-100 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border-2 border-purple-300 shadow-sm">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  <div className="text-left">
                    <div className="text-[8px] sm:text-[10px] text-purple-600 font-semibold uppercase">Avg Time</div>
                    <div className="text-sm sm:text-lg font-bold text-purple-900">{formatTime(overallStats.avgTime || 0)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-blue-100 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border-2 border-blue-300 shadow-sm">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  <div className="text-left">
                    <div className="text-[8px] sm:text-[10px] text-blue-600 font-semibold uppercase">In-House</div>
                    <div className="text-sm sm:text-lg font-bold text-blue-900">{overallStats.source.inHouse}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-gradient-to-r from-orange-50 to-orange-100 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border-2 border-orange-300 shadow-sm">
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                  <div className="text-left">
                    <div className="text-[8px] sm:text-[10px] text-orange-600 font-semibold uppercase">Outsource</div>
                    <div className="text-sm sm:text-lg font-bold text-orange-900">{overallStats.source.outsource}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={isMobile ? 350 : 600}>
            <ComposedChart 
              data={summary} 
              margin={{ 
                top: 40, 
                right: isMobile ? 10 : 100, 
                left: isMobile ? -10 : 30, 
                bottom: isMobile ? 80 : 120 
              }}
            >
              <defs>
                <linearGradient id="idealTimeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" stroke="#e1e7ef" vertical={false} opacity={0.5} />
              
              <XAxis
                dataKey="displayName"
                angle={-35}
                textAnchor="end"
                height={100}
                interval={0}
                tick={{ fontSize: 13, fill: '#1e293b', fontWeight: 600 }}
                axisLine={{ stroke: '#94a3b8', strokeWidth: 2 }}
                tickLine={{ stroke: '#94a3b8', strokeWidth: 1.5 }}
              />
              
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 13, fill: '#475569', fontWeight: 500 }}
                axisLine={{ stroke: '#94a3b8', strokeWidth: 2 }}
                tickLine={{ stroke: '#94a3b8', strokeWidth: 1.5 }}
                label={{ 
                  value: 'Tickets Completed', 
                  angle: -90, 
                  position: 'insideLeft', 
                  style: { fontSize: 14, fill: '#1e293b', fontWeight: 700 } 
                }}
              />
              
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 13, fill: '#7c3aed', fontWeight: 500 }}
                axisLine={{ stroke: '#a78bfa', strokeWidth: 2 }}
                tickLine={{ stroke: '#a78bfa', strokeWidth: 1.5 }}
                label={{ 
                  value: 'Average Time (Hours)', 
                  angle: 90, 
                  position: 'insideRight', 
                  style: { fontSize: 14, fill: '#7c3aed', fontWeight: 700 } 
                }}
              />
              
              <Tooltip
                cursor={{ fill: '#e0e7ff', opacity: 0.4 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0]?.payload;
                    const globalAvg = overallStats.avgTime || 0;
                    const idealTime = globalAvg * 0.85;
                    const timeEfficiency = globalAvg > 0 
                      ? ((globalAvg - data.averageTimeHours) / globalAvg * 100)
                      : 0;
                    const isEfficient = timeEfficiency > 0;
                    const exceedsIdeal = data.averageTimeHours > idealTime;
                    
                    const agencyContribution = agencyPerformanceData
                      .map(agency => {
                        const catData = agency.categories.find(c => c.category === data.category);
                        return catData ? {
                          name: agency.name,
                          count: catData.count,
                          avgTime: agency.avgTime,
                          percentage: ((catData.count / data.totalCompleted) * 100).toFixed(0)
                        } : null;
                      })
                      .filter(Boolean)
                      .sort((a, b) => (b?.count || 0) - (a?.count || 0));

                    return (
                      <div className={`bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-2xl border-2 sm:border-3 border-indigo-300 min-w-0 ${isMobile ? 'w-[calc(100vw-40px)]' : 'min-w-[420px] max-w-[480px]'}`}>
                        <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-slate-200">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-4 h-4 rounded-full shadow-md" 
                              style={{ backgroundColor: data.color }}
                            />
                            <p className="font-bold text-slate-900 text-xl">{data.displayName}</p>
                          </div>
                          <div className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${
                            isEfficient 
                              ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300' 
                              : 'bg-rose-100 text-rose-700 border-2 border-rose-300'
                          }`}>
                            {isEfficient ? '✓ Efficient' : '⚠ Needs Focus'}
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-3 rounded-xl border-2 border-teal-200 shadow-sm">
                              <div className="text-[10px] text-teal-600 font-bold uppercase mb-1">Total Tickets</div>
                              <div className="font-bold text-teal-800 text-2xl">{data.totalCompleted}</div>
                            </div>
                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded-xl border-2 border-purple-200 shadow-sm">
                              <div className="text-[10px] text-purple-600 font-bold uppercase mb-1">Actual Time</div>
                              <div className="font-bold text-purple-800 text-2xl">{formatTime(data.averageTimeHours)}</div>
                            </div>
                            <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-3 rounded-xl border-2 border-slate-200 shadow-sm">
                              <div className="text-[10px] text-slate-600 font-bold uppercase mb-1">Ideal Time</div>
                              <div className="font-bold text-slate-800 text-2xl">{formatTime(idealTime)}</div>
                            </div>
                          </div>

                          <div className={`p-4 rounded-xl border-2 shadow-md ${
                            exceedsIdeal 
                              ? 'bg-gradient-to-r from-rose-50 to-red-50 border-rose-300' 
                              : 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-300'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-bold text-slate-800">Performance vs Ideal</span>
                              <span className={`text-lg font-bold ${
                                exceedsIdeal ? 'text-rose-700' : 'text-emerald-700'
                              }`}>
                                {exceedsIdeal ? '+' : ''}{((data.averageTimeHours - idealTime) / idealTime * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="text-xs text-slate-700 leading-relaxed">
                              {exceedsIdeal 
                                ? `⚠ ${((data.averageTimeHours - idealTime) / idealTime * 100).toFixed(0)}% slower than ideal - priority optimization area`
                                : `✓ Performing ${Math.abs((data.averageTimeHours - idealTime) / idealTime * 100).toFixed(0)}% better than ideal`
                              }
                            </div>
                          </div>

                          <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-200">
                            <p className="text-xs font-bold text-slate-700 uppercase mb-3">Priority Distribution</p>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="bg-white p-3 rounded-lg border-2 border-red-200 shadow-sm text-center">
                                <div className="text-[10px] text-red-600 font-bold mb-1">HIGH</div>
                                <div className="text-xl font-bold text-red-700">{data.priority.high}</div>
                                <div className="text-[10px] text-red-500 font-semibold mt-1">
                                  {data.totalCompleted > 0 ? `${((data.priority.high / data.totalCompleted) * 100).toFixed(0)}%` : '0%'}
                                </div>
                              </div>
                              <div className="bg-white p-3 rounded-lg border-2 border-amber-200 shadow-sm text-center">
                                <div className="text-[10px] text-amber-600 font-bold mb-1">MEDIUM</div>
                                <div className="text-xl font-bold text-amber-700">{data.priority.medium}</div>
                                <div className="text-[10px] text-amber-500 font-semibold mt-1">
                                  {data.totalCompleted > 0 ? `${((data.priority.medium / data.totalCompleted) * 100).toFixed(0)}%` : '0%'}
                                </div>
                              </div>
                              <div className="bg-white p-3 rounded-lg border-2 border-emerald-200 shadow-sm text-center">
                                <div className="text-[10px] text-emerald-600 font-bold mb-1">LOW</div>
                                <div className="text-xl font-bold text-emerald-700">{data.priority.low}</div>
                                <div className="text-[10px] text-emerald-500 font-semibold mt-1">
                                  {data.totalCompleted > 0 ? `${((data.priority.low / data.totalCompleted) * 100).toFixed(0)}%` : '0%'}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-slate-50 p-4 rounded-xl border-2 border-slate-200">
                            <p className="text-xs font-bold text-slate-700 uppercase mb-3">Work Source</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-lg border-2 border-blue-300 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                  <Users className="w-4 h-4 text-blue-600" />
                                  <span className="text-xs text-blue-700 font-bold">In-House</span>
                                </div>
                                <div className="text-2xl font-bold text-blue-800 mb-1">{data.source.inHouse}</div>
                                <div className="text-[10px] text-blue-600 font-semibold">
                                  {data.totalCompleted > 0 ? `${((data.source.inHouse / data.totalCompleted) * 100).toFixed(0)}%` : '0%'} of workload
                                </div>
                              </div>
                              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-3 rounded-lg border-2 border-orange-300 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                  <Building2 className="w-4 h-4 text-orange-600" />
                                  <span className="text-xs text-orange-700 font-bold">Outsourced</span>
                                </div>
                                <div className="text-2xl font-bold text-orange-800 mb-1">{data.source.outsource}</div>
                                <div className="text-[10px] text-orange-600 font-semibold">
                                  {data.totalCompleted > 0 ? `${((data.source.outsource / data.totalCompleted) * 100).toFixed(0)}%` : '0%'} of workload
                                </div>
                              </div>
                            </div>
                          </div>

                          {agencyContribution.length > 0 && (
                            <div className="bg-indigo-50 p-4 rounded-xl border-2 border-indigo-200">
                              <p className="text-xs font-bold text-indigo-700 uppercase mb-3 flex items-center gap-2">
                                <Activity className="w-3.5 h-3.5" />
                                Agency Contribution ({agencyContribution.length})
                              </p>
                              <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                                {agencyContribution.slice(0, 5).map((agency: any) => (
                                  <div key={agency.name} className="bg-white p-3 rounded-lg border border-indigo-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-sm text-slate-800 font-bold truncate flex-1">{agency.name}</span>
                                      <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                                        {agency.percentage}%
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-1.5">
                                        <CheckCircle2 className="w-3 h-3 text-teal-600" />
                                        <span className="text-teal-700 font-bold">{agency.count} tickets</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <Clock className="w-3 h-3 text-purple-600" />
                                        <span className="text-purple-700 font-bold">{formatTime(agency.avgTime)}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="bg-gradient-to-r from-indigo-100 to-purple-100 p-4 rounded-xl border-2 border-indigo-300 shadow-md">
                            <div className="flex items-start gap-3">
                              <div className="p-1.5 bg-white rounded-lg shadow-sm">
                                <Info className="w-4 h-4 text-indigo-600" />
                              </div>
                              <div className="flex-1">
                                <div className="text-xs font-bold text-indigo-900 uppercase mb-1">Recommendation</div>
                                <div className="text-xs text-indigo-800 leading-relaxed">
                                  {exceedsIdeal 
                                    ? `⚠ Exceeds ideal by ${((data.averageTimeHours - idealTime) / idealTime * 100).toFixed(0)}%. Review ${data.priority.high > 0 ? 'high-priority' : 'workflow'} processes.`
                                    : `✓ Excellent! ${Math.abs((data.averageTimeHours - idealTime) / idealTime * 100).toFixed(0)}% better than ideal. Share these best practices.`
                                  }
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              
              <ReferenceLine 
                yAxisId="right"
                y={(overallStats.avgTime || 0) * 0.85}
                stroke="#64748b"
                strokeDasharray="8 4"
                strokeWidth={2}
                label={{
                  value: `Ideal: ${formatTime((overallStats.avgTime || 0) * 0.85)}`,
                  position: 'right',
                  fill: '#475569',
                  fontSize: 11,
                  fontWeight: 600
                }}
              />
              
              <Bar 
                yAxisId="left"
                dataKey="priority.high" 
                stackId="priority"
                fill="#ef4444"
                radius={[0, 0, 0, 0]}
                barSize={70}
              />
              <Bar 
                yAxisId="left"
                dataKey="priority.medium" 
                stackId="priority"
                fill="#f59e0b"
                radius={[0, 0, 0, 0]}
                barSize={70}
              />
              <Bar 
                yAxisId="left"
                dataKey="priority.low" 
                stackId="priority"
                fill="#10b981"
                radius={[10, 10, 0, 0]}
                barSize={70}
              />

              <Line
                yAxisId="right"
                type="monotone"
                dataKey="averageTimeHours"
                stroke="#7c3aed"
                strokeWidth={4}
                dot={{ r: 8, fill: '#7c3aed', strokeWidth: 3, stroke: '#fff' }}
                activeDot={{ r: 10, strokeWidth: 0, fill: '#7c3aed' }}
                label={(props: any) => {
                  const { x, y, value } = props;
                  if (typeof x !== 'number' || typeof y !== 'number') return null;
                  const idealTime = (overallStats.avgTime || 0) * 0.85;
                  const exceedsIdeal = value > idealTime;
                  
                  return (
                    <g>
                      <rect
                        x={x - 35}
                        y={y - 28}
                        width={70}
                        height={22}
                        fill={exceedsIdeal ? '#fef2f2' : '#f0fdf4'}
                        stroke={exceedsIdeal ? '#fca5a5' : '#86efac'}
                        strokeWidth={2}
                        rx={6}
                        opacity={0.95}
                      />
                      <text
                        x={x}
                        y={y - 12}
                        fill={exceedsIdeal ? '#dc2626' : '#16a34a'}
                        fontSize={12}
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {formatTime(value as number)}
                      </text>
                    </g>
                  );
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>

          <div className="mt-8 pt-6 border-t-2 border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-xs font-bold text-slate-600 uppercase mb-3">Priority Levels</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-red-500 shadow-sm" />
                      <span className="text-sm text-gray-700 font-medium">High</span>
                    </div>
                    <span className="text-sm font-bold text-red-600">{overallStats.priority.high}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-amber-500 shadow-sm" />
                      <span className="text-sm text-gray-700 font-medium">Medium</span>
                    </div>
                    <span className="text-sm font-bold text-amber-600">{overallStats.priority.medium}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-emerald-500 shadow-sm" />
                      <span className="text-sm text-gray-700 font-medium">Low</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">{overallStats.priority.low}</span>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                <div className="text-xs font-bold text-purple-700 uppercase mb-3">Time Metrics</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-purple-600 shadow-sm" />
                      <span className="text-sm text-gray-700 font-medium">Actual Avg</span>
                    </div>
                    <span className="text-sm font-bold text-purple-700">{formatTime(overallStats.avgTime || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-1 bg-slate-500 rounded" style={{ borderTop: '2px dashed #64748b' }} />
                      <span className="text-sm text-gray-700 font-medium">Ideal</span>
                    </div>
                    <span className="text-sm font-bold text-slate-600">{formatTime((overallStats.avgTime || 0) * 0.85)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-purple-200">
                    <span className="text-xs text-purple-600 font-semibold">Exceeding ideal:</span>
                    <span className="text-sm font-bold text-rose-600">
                      {summary.filter(c => c.averageTimeHours > (overallStats.avgTime || 0) * 0.85).length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                <div className="text-xs font-bold text-blue-700 uppercase mb-3">Work Source</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="text-sm text-gray-700 font-medium">In-House</span>
                    </div>
                    <span className="text-sm font-bold text-blue-700">{overallStats.source.inHouse}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-orange-600" />
                      <span className="text-sm text-gray-700 font-medium">Outsourced</span>
                    </div>
                    <span className="text-sm font-bold text-orange-700">{overallStats.source.outsource}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-blue-200">
                    <span className="text-xs text-blue-600 font-semibold">Agencies:</span>
                    <span className="text-sm font-bold text-indigo-600">{agencyPerformanceData.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Summary Cards */}
        <div className="mb-8 sm:mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 flex-shrink-0" />
              Category Performance Overview
            </h2>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>Detailed metrics for each category</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
              {summary.map((cat) => {
                const isExpanded = expandedCategories.has(cat.category);
                const toggleExpand = () => {
                  setExpandedCategories(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(cat.category)) {
                      newSet.delete(cat.category);
                    } else {
                      newSet.add(cat.category);
                    }
                    return newSet;
                  });
                };

                return (
                  <div
                    key={cat.category}
                    className="bg-white rounded-2xl shadow-sm border-2 p-4 transition-all hover:shadow-lg"
                    style={{
                      borderLeftWidth: '4px',
                      borderLeftColor: cat.color,
                      borderTopColor: '#e5e7eb',
                      borderRightColor: '#e5e7eb',
                      borderBottomColor: '#e5e7eb'
                    }}
                  >
                    {/* Compact View - Single Row Layout */}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 flex-wrap min-w-0">
                        {/* Category Name */}
                        <h3 className="font-semibold text-gray-900 text-base flex-shrink-0">{cat.displayName}</h3>
                        
                        {/* Avg Time */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Clock className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                          <span className="text-xs font-medium text-gray-600">Avg Time:</span>
                          <span className="text-xs font-bold text-blue-700">
                            {formatTime(cat.averageTimeHours)}
                          </span>
                        </div>

                        {/* Ticket Count */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="bg-teal-100 text-teal-700 px-2.5 py-1 rounded-full text-xs font-bold">
                            {cat.totalCompleted}
                          </span>
                          <span className="text-xs text-gray-600">tickets</span>
                        </div>
                      </div>

                      {/* Dropdown Toggle */}
                      <button
                        onClick={toggleExpand}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-all flex-shrink-0"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        <ChevronDown 
                          className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {/* Detailed View - Collapsible */}
                    {isExpanded && (
                      <div className="space-y-3 mt-4 pt-4 border-t border-gray-200">
                        {/* Priority Breakdown */}
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Priority Distribution</div>
                      <div className="flex items-center justify-between text-xs">
                        <span
                          onClick={() => {
                            // Navigate to dashboard with category and high priority filter
                            router.push(`/dashboard?category=${encodeURIComponent(cat.category)}&priority=high&status=COMPLETED`);
                          }}
                          className="flex items-center gap-1.5 cursor-pointer hover:opacity-70 transition-opacity"
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                          <span className="text-gray-700 font-medium">High: {cat.priority.high}</span>
                        </span>
                        <span
                          onClick={() => {
                            // Navigate to dashboard with category and medium priority filter
                            router.push(`/dashboard?category=${encodeURIComponent(cat.category)}&priority=medium&status=COMPLETED`);
                          }}
                          className="flex items-center gap-1.5 cursor-pointer hover:opacity-70 transition-opacity"
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                          <span className="text-gray-700 font-medium">Med: {cat.priority.medium}</span>
                        </span>
                        <span
                          onClick={() => {
                            // Navigate to dashboard with category and low priority filter
                            router.push(`/dashboard?category=${encodeURIComponent(cat.category)}&priority=low&status=COMPLETED`);
                          }}
                          className="flex items-center gap-1.5 cursor-pointer hover:opacity-70 transition-opacity"
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                          <span className="text-gray-700 font-medium">Low: {cat.priority.low}</span>
                        </span>
                      </div>
                    </div>

                    {/* Source Breakdown */}
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Work Source</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                          <span className="text-gray-700">In-House</span>
                        </div>
                        <div className="text-right font-bold text-gray-900">{cat.source.inHouse}</div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                          <span className="text-gray-700">Outsource</span>
                        </div>
                        <div className="text-right font-bold text-gray-900">{cat.source.outsource}</div>
                      </div>
                    </div>

                    {/* Subcategory Avg Completion Time */}
                    {subcategoryBreakdown.get(cat.category) && subcategoryBreakdown.get(cat.category)!.size > 0 && (
                      <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
                        <div className="text-xs font-semibold text-purple-700 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          Avg Time by Subcategory
                        </div>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {(Array.from(subcategoryBreakdown.get(cat.category)!.entries()) as [string, { count: number; totalTime: number; avgTime: number }][])
                            .sort((a, b) => b[1].avgTime - a[1].avgTime)
                            .map(([subCat, data]) => (
                              <div key={subCat} className="flex items-center justify-between text-xs">
                                <span className="text-gray-700 truncate flex-1 mr-2" title={subCat}>
                                  {subCat}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 text-[10px]">({data.count})</span>
                                  <span className="font-bold text-purple-700 min-w-[45px] text-right">
                                    {formatTime(data.avgTime)}
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
        </div>

        {/* Charts Section */}
        <div className="space-y-6 sm:space-y-8 mb-8 sm:mb-12">
          {/* Completion Trends - Area Chart */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-8">
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-teal-600 flex-shrink-0" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Completion Trends</h3>
                </div>
                <div className="flex items-center gap-2 bg-teal-50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-teal-200 self-start sm:self-auto">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-teal-900">Total: {overallStats.total}</span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-600">
                A performance matrix comparing total tickets completed (Bars) against average resolution time (Line).
              </p>
            </div>
            <ResponsiveContainer width="100%" height={isMobile ? 350 : 450}>
              <ComposedChart data={barChartData} margin={{ top: 30, right: 60, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e1e7ef" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={<CustomXAxisTick />}
                  interval={0}
                  height={110}
                  tickMargin={30}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  label={{ 
                    value: 'Tickets Completed', 
                    angle: -90, 
                    position: 'insideLeft', 
                    style: { fontSize: 12, fill: '#64748b', fontWeight: 600 } 
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12, fill: '#8b5cf6' }}
                  label={{ 
                    value: 'Avg. Hours to Resolution', 
                    angle: 90, 
                    position: 'insideRight', 
                    style: { fontSize: 12, fill: '#8b5cf6', fontWeight: 600 } 
                  }}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9', opacity: 0.4 }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[1]?.payload || payload[0]?.payload;
                      const globalAvg = overallStats.avgTime || 0;
                      const timeEfficiency = globalAvg > 0 
                        ? ((globalAvg - data.avgTime) / globalAvg * 100).toFixed(0)
                        : 0;

                      return (
                        <div className={`bg-white p-4 sm:p-5 rounded-xl shadow-2xl border border-slate-200 ${isMobile ? 'w-[calc(100vw-60px)]' : 'min-w-[240px]'}`}>
                          <p className="font-bold text-slate-900 text-base mb-3 border-b pb-2">{label}</p>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 text-sm">Volume:</span>
                              <span className="font-bold text-slate-900">{data.completed} tickets</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 text-sm">Resolution Time:</span>
                              <span className="font-bold text-purple-600">{formatTime(data.avgTime)}</span>
                            </div>
                            <div className={`mt-2 pt-2 border-t flex items-center gap-2 text-xs font-bold ${Number(timeEfficiency) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              <span className={`w-2 h-2 rounded-full ${Number(timeEfficiency) >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              {Number(timeEfficiency) >= 0 ? `${timeEfficiency}% Faster than Avg` : `${Math.abs(Number(timeEfficiency))}% Slower than Avg`}
                            </div>
                          </div>
                          <p className="mt-4 text-[10px] text-slate-400 italic">Click bar to drill down subcategories</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  yAxisId="left"
                  dataKey="completed" 
                  radius={[6, 6, 0, 0]}
                  barSize={40}
                  onClick={(data: any) => {
                    const payload = data?.activePayload?.[0]?.payload || data;
                    if (payload && payload.category) {
                      const subSection = document.getElementById('subcategory-section');
                      setSelectedSubCategoryFilter(payload.category);
                      subSection?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {barChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgTime"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  dot={{ r: 6, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 8, strokeWidth: 0, fill: '#8b5cf6' }}
                  isAnimationActive={true}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>



          {/* Average Completion Time by Category */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-8">
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600 flex-shrink-0" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Average Completion Time by Category</h3>
                </div>
                <div className="flex items-center gap-2 bg-purple-50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-purple-200 self-start sm:self-auto">
                  <Clock className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-purple-900">
                    Overall: {summary.length > 0
                      ? formatTime(summary.reduce((acc, cat) => acc + cat.averageTimeHours, 0) / summary.length)
                      : "0h"
                    }
                  </span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-600">
                Average time taken to complete tickets in each category. Lower bars indicate faster completion.
              </p>
            </div>
            <ResponsiveContainer width="100%" height={isMobile ? 350 : 550}>
                <BarChart data={barChartData} margin={{ top: 30, right: 40, left: 20, bottom: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={<CustomXAxisTick />}
                    interval={0}
                    height={90}
                    tickMargin={20}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#4b5563' }}
                    label={{ value: 'Average Time (Hours)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#4b5563', fontWeight: 600 } }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const avgTime = payload[0]?.value as number;
                        // Find subcategory data for this category
                        const catData = subcategoryAvgTimeData.find(c => c.displayName === label);
                        return (
                          <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200 max-w-xs">
                            <p className="font-semibold text-gray-900 mb-2">{label}</p>
                            <p className="text-sm text-purple-600 border-b pb-2 mb-2">
                              Category Avg: <span className="font-bold">{formatTime(avgTime)}</span>
                              <span className="text-xs text-gray-500 ml-1">({avgTime?.toFixed(1)}h)</span>
                            </p>
                            {catData && catData.subcategories.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">By Subcategory:</p>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                  {catData.subcategories.map((sub, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-xs">
                                      <span className="text-gray-700 truncate flex-1 mr-2" title={sub.name}>{sub.name}</span>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-gray-400">({sub.count})</span>
                                        <span className="font-bold text-purple-700">{formatTime(sub.avgTime)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="avgTime"
                    radius={[8, 8, 0, 0]}
                    label={{
                      position: 'top',
                      fontSize: 11,
                      fill: '#6d28d9',
                      fontWeight: 'bold'
                    }}
                  >
                    {barChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

            {/* Subcategory Bar Charts Section */}
            {subcategoryAvgTimeData.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex flex-col  md:items-center md:justify-between gap-4 mb-6">
                  <div className="flex items-center justify-between w-full" id="subcategory-section">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-purple-600" />
                      <h4 className="text-lg font-semibold text-gray-900">Average Completion Time by Subcategory</h4>
                    </div>
                  </div>

                  {/* Category Filter Buttons */}
                  <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedSubCategoryFilter('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedSubCategoryFilter === 'all'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        All Categories
                      </button>
                      {subcategoryAvgTimeData.map((catData) => (
                        <button
                          key={catData.category}
                          onClick={() => setSelectedSubCategoryFilter(catData.category)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${selectedSubCategoryFilter === catData.category
                            ? 'text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          style={{
                            backgroundColor: selectedSubCategoryFilter === catData.category ? catData.color : undefined
                          }}
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: selectedSubCategoryFilter === catData.category ? '#fff' : catData.color }}
                          />
                          {catData.displayName}
                        </button>
                      ))}
                    </div>
                </div>
                <div className="space-y-3">
                  {selectedSubCategoryFilter === 'all' ? (
                    /* Show combined chart for all categories */
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <h5 className="font-semibold text-gray-800 text-sm">
                          All Subcategories Combined
                          <span className="ml-2 text-xs font-normal text-gray-500">
                            ({allSubcategoriesCombined.length} subcategories)
                          </span>
                        </h5>
                      </div>

                      <div 
                        className="h-auto relative"
                        onMouseLeave={() => {
                          setActiveTooltip(prev => prev?.chartId === 'all-combined' ? null : prev);
                        }}
                      >
                        <ResponsiveContainer width="100%" height={isMobile ? 350 : 400}>
                          <BarChart
                            data={allSubcategoriesCombined}
                            margin={{ 
                              top: 20, 
                              right: isMobile ? 10 : 30, 
                              left: isMobile ? -20 : 50, 
                              bottom: isMobile ? 100 : 120 
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                            <XAxis
                              dataKey="name"
                              type="category"
                              angle={isMobile ? -90 : -45}
                              textAnchor="end"
                              height={isMobile ? 120 : 100}
                              interval={0}
                              tick={{ fontSize: isMobile ? 8 : 9, fill: '#6b7280', fontWeight: 400 }}
                              axisLine={{ stroke: '#d1d5db' }}
                              tickLine={{ stroke: '#d1d5db' }}
                            />
                            <YAxis 
                              type="number"
                              tick={{ fontSize: isMobile ? 9 : 10, fill: '#6b7280' }}
                              axisLine={{ stroke: '#d1d5db' }}
                              tickLine={{ stroke: '#d1d5db' }}
                              label={isMobile ? undefined : { 
                                value: 'Avg Time (Hours)', 
                                angle: -90, 
                                position: 'insideLeft',
                                style: { fontSize: 11, fill: '#6b7280', fontWeight: 500 } 
                              }}
                            />
                            <Bar
                              dataKey="avgTime"
                              radius={[4, 4, 0, 0]}
                              barSize={isMobile ? 20 : 40}
                              isAnimationActive={false}
                              style={{ cursor: 'pointer', transition: 'filter 0.3s' }}
                              onMouseEnter={(data: any) => {
                                if (data) {
                                  setActiveTooltip({
                                    data: data.payload,
                                    pos: { x: data.x + data.width / 2, y: data.y },
                                    chartId: 'all-combined'
                                  });
                                }
                              }}
                              onClick={() => {
                                if (activeTooltip?.data?.ticketIds?.length === 1) {
                                  setSelectedTicketId(activeTooltip.data.ticketIds[0]);
                                }
                              }}
                              activeBar={{ filter: 'brightness(1.1) saturate(1.2)' }}
                              label={(props: any) => {
                                const { x, y, width, value } = props;
                                if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number') return null;
                                return (
                                  <text
                                    x={x + width / 2}
                                    y={y - 4}
                                    fill="#6b7280"
                                    fontSize={9}
                                    fontWeight="600"
                                    textAnchor="middle"
                                    className="opacity-90 pointer-events-none"
                                  >
                                    {formatTime(value as number)}
                                  </text>
                                );
                              }}
                            >
                              {allSubcategoriesCombined.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>

                        {/* Manual Stable Tooltip for Combined Chart */}
                        {activeTooltip && activeTooltip.chartId === 'all-combined' && (
                          <div 
                            style={isMobile ? {
                              position: 'absolute',
                              left: '10px',
                              right: '10px',
                              bottom: '0px',
                              zIndex: 100,
                              pointerEvents: 'auto'
                            } : { 
                              position: 'absolute',
                              left: activeTooltip.pos.x + 15,
                              top: activeTooltip.pos.y,
                              transform: 'translateY(-50%)',
                              zIndex: 100,
                              pointerEvents: 'auto'
                            }}
                            className="animate-in fade-in zoom-in duration-200"
                          >
                            <div className={`bg-white p-4 rounded-xl shadow-[0_20px_50px_rgba(109,40,217,0.15)] border border-purple-100 pointer-events-auto ${isMobile ? 'w-full' : 'max-w-sm'}`}>
                              <div className="flex items-center justify-between gap-4 mb-3">
                                <p className="font-bold text-gray-900 text-sm">{activeTooltip.data.name}</p>
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 rounded-full border border-purple-100">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                  <span className="text-[10px] font-bold text-purple-700">{formatTime(activeTooltip.data.avgTime || 0)}</span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 mb-4 text-[11px] text-gray-500">
                                <span className="font-medium text-gray-700">Total Samples: {activeTooltip.data.count}</span>
                                <span>•</span>
                                <span>Click a ticket ID below</span>
                              </div>

                              {activeTooltip.data.ticketIds && activeTooltip.data.ticketIds.length > 0 && (
                                <div className="pt-3 border-t border-gray-50">
                                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1 thin-scrollbar">
                                    {activeTooltip.data.ticketIds.map((ticketId: string) => (
                                      <button
                                        key={ticketId}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          setSelectedTicketId(ticketId);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-purple-600 text-purple-700 hover:text-white rounded-lg text-xs font-bold transition-all border border-purple-100 hover:border-purple-600 shadow-sm hover:shadow-md active:scale-95 group"
                                      >
                                        <span className="text-[10px] opacity-60 group-hover:opacity-100">🎫</span>
                                        <span>{ticketId}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Show individual category charts */
                    subcategoryAvgTimeData
                      .filter(catData => catData.category === selectedSubCategoryFilter)
                      .map((catData) => (
                  <div key={catData.category} className="bg-white rounded-lg border border-gray-200 p-2 sm:p-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: catData.color }}
                      />
                      <h5 className="font-semibold text-gray-800 text-xs sm:text-sm">
                        {catData.displayName}
                        <span className="ml-1 text-[10px] font-normal text-gray-400">
                          ({catData.subcategories.length} subcategories)
                        </span>
                      </h5>
                    </div>

                    <div 
                      className="h-auto relative"
                      onMouseLeave={() => {
                        setActiveTooltip(prev => prev?.chartId === catData.category ? null : prev);
                      }}
                    >
                      <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                        <BarChart
                          data={catData.subcategories}
                          margin={{ top: 25, right: 10, left: 10, bottom: 50 }}
                          barCategoryGap="10%"
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                          <XAxis
                            dataKey="name"
                            type="category"
                            angle={-45}
                            textAnchor="end"
                            height={50}
                            interval={0}
                            tick={{ fontSize: 9, fill: '#6b7280', fontWeight: 400 }}
                            axisLine={{ stroke: '#d1d5db' }}
                            tickLine={{ stroke: '#d1d5db' }}
                          />
                          <YAxis
                            type="number"
                            tick={{ fontSize: 9, fill: '#6b7280' }}
                            axisLine={{ stroke: '#d1d5db' }}
                            tickLine={{ stroke: '#d1d5db' }}
                            label={{ 
                              value: 'Avg Time (Hours)', 
                              angle: -90, 
                              position: 'insideLeft', 
                              style: { fontSize: 10, fill: '#6b7280', fontWeight: 500 } 
                            }}
                          />
                          <Bar
                            dataKey="avgTime"
                            fill={catData.color}
                            radius={[4, 4, 0, 0]}
                            barSize={30}
                            isAnimationActive={false}
                            style={{ cursor: 'pointer', transition: 'filter 0.3s' }}
                            onMouseEnter={(data: any) => {
                              if (data) {
                                setActiveTooltip({
                                  data: data.payload,
                                  pos: { x: data.x + data.width / 2, y: data.y },
                                  chartId: catData.category
                                });
                              }
                            }}
                            onClick={() => {
                              if (activeTooltip?.data?.ticketIds?.length === 1) {
                                setSelectedTicketId(activeTooltip.data.ticketIds[0]);
                              }
                            }}
                            activeBar={{ filter: 'brightness(1.1) saturate(1.2)' }}
                            label={(props: any) => {
                              const { x, y, width, value } = props;
                              if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number') return null;
                              return (
                                <text
                                  x={x + width / 2}
                                  y={y - 4}
                                  fill={catData.color}
                                  fontSize={9}
                                  fontWeight="600"
                                  textAnchor="middle"
                                  className="opacity-90 pointer-events-none"
                                >
                                  {formatTime(value as number)}
                                </text>
                              );
                            }}
                          />
                        </BarChart>
                      </ResponsiveContainer>

                      {/* Manual Stable Tooltip */}
                      {activeTooltip && activeTooltip.chartId === catData.category && (
                        <div 
                          style={{ 
                            position: 'absolute',
                            left: activeTooltip.pos.x + 15,
                            top: activeTooltip.pos.y,
                            transform: 'translateY(-50%)',
                            zIndex: 100,
                            pointerEvents: 'auto'
                          }}
                          className="animate-in fade-in zoom-in duration-200"
                        >
                          <div className="bg-white p-4 rounded-xl shadow-[0_20px_50px_rgba(109,40,217,0.15)] border border-purple-100 max-w-sm pointer-events-auto">
                            <div className="flex items-center justify-between gap-4 mb-3">
                              <p className="font-bold text-gray-900 text-sm">{activeTooltip.data.name}</p>
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 rounded-full border border-purple-100">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                <span className="text-[10px] font-bold text-purple-700">{formatTime(activeTooltip.data.avgTime || 0)}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 mb-4 text-[11px] text-gray-500">
                              <span className="font-medium text-gray-700">Total Samples: {activeTooltip.data.count}</span>
                              <span>•</span>
                              <span>Click a ticket ID below</span>
                            </div>

                            {activeTooltip.data.ticketIds && activeTooltip.data.ticketIds.length > 0 && (
                              <div className="pt-3 border-t border-gray-50">
                                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1 thin-scrollbar">
                                  {activeTooltip.data.ticketIds.map((ticketId: string) => (
                                    <button
                                      key={ticketId}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setSelectedTicketId(ticketId);
                                      }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-purple-600 text-purple-700 hover:text-white rounded-lg text-xs font-bold transition-all border border-purple-100 hover:border-purple-600 shadow-sm hover:shadow-md active:scale-95 group"
                                    >
                                      <span className="text-[10px] opacity-60 group-hover:opacity-100">🎫</span>
                                      <span>{ticketId}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
                  )}
                  </div>
                </div>
              )}
            </div>



          {/* Pie Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Work Distribution - Pie Chart */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
              <div className="mb-4 sm:mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <PieChartIcon className="w-5 h-5 text-teal-600" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Work Distribution by Category</h3>
                </div>
                <p className="text-xs sm:text-sm text-gray-600">
                  Percentage breakdown of completed work across different categories.
                </p>
              </div>
              <ResponsiveContainer width="100%" height={isMobile ? 300 : 320}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip formatter={(value: number) => `${value} tickets`} />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    wrapperStyle={{ fontSize: '11px' }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Priority Distribution - Pie Chart */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6">
              <div className="mb-4 sm:mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5 text-red-600" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Priority Level Distribution</h3>
                </div>
                <p className="text-xs sm:text-sm text-gray-600">
                  Distribution of completed tickets by priority level.
                </p>
              </div>
              <ResponsiveContainer width="100%" height={isMobile ? 300 : 320}>
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip formatter={(value: number) => `${value} tickets`} />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    wrapperStyle={{ fontSize: '11px' }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Agency-wise Performance Section */}
        {agencyPerformanceData.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-8 mb-8 sm:mb-12">
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Agency-wise Performance Overview</h3>
                </div>
                <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 self-start sm:self-auto">
                  <span className="text-xs sm:text-sm font-semibold text-indigo-900">
                    {agencyPerformanceData.length} {agencyPerformanceData.length === 1 ? 'Agency' : 'Agencies'}
                  </span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-600">
                Complete performance metrics for each agency.
              </p>
            </div>

            {/* Agency Performance Bar Chart */}
            <ResponsiveContainer width="100%" height={isMobile ? 350 : 400}>
              <ComposedChart 
                data={agencyPerformanceData} 
                margin={{ 
                  top: 40, 
                  right: isMobile ? 10 : 60, 
                  left: isMobile ? -10 : 20, 
                  bottom: 80 
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e1e7ef" vertical={false} />
                <XAxis
                  dataKey="name"
                  angle={isMobile ? -90 : -45}
                  textAnchor="end"
                  height={isMobile ? 100 : 80}
                  interval={0}
                  tick={{ fontSize: isMobile ? 9 : 11, fill: '#4b5563', fontWeight: 500 }}
                  axisLine={{ stroke: '#d1d5db' }}
                  tickLine={{ stroke: '#d1d5db' }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: isMobile ? 10 : 12, fill: '#64748b' }}
                  label={isMobile ? undefined : { 
                    value: 'Total Time (Hours)', 
                    angle: -90, 
                    position: 'insideLeft', 
                    style: { fontSize: 12, fill: '#64748b', fontWeight: 600 } 
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: isMobile ? 10 : 12, fill: '#6366f1' }}
                  label={isMobile ? undefined : { 
                    value: 'Tickets Handled', 
                    angle: 90, 
                    position: 'insideRight', 
                    style: { fontSize: 12, fill: '#6366f1', fontWeight: 600 } 
                  }}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9', opacity: 0.4 }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0]?.payload;
                      return (
                        <div className={`bg-white p-4 sm:p-5 rounded-xl shadow-2xl border border-slate-200 ${isMobile ? 'w-[calc(100vw-60px)]' : 'min-w-[260px]'}`}>
                          <p className="font-bold text-slate-900 text-base mb-3 border-b pb-2">{label}</p>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 text-sm">Total Time:</span>
                              <span className="font-bold text-orange-600">{formatTime(data.totalTime)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 text-sm">Tickets Handled:</span>
                              <span className="font-bold text-indigo-600">{data.totalTickets} tickets</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 text-sm">Avg Time:</span>
                              <span className="font-bold text-purple-600">{formatTime(data.avgTime)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  yAxisId="left"
                  dataKey="totalTime" 
                  fill="#f97316"
                  radius={[8, 8, 0, 0]}
                  barSize={50}
                  label={(props: any) => {
                    const { x, y, width, value } = props;
                    if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number') return null;
                    return (
                      <text
                        x={x + width / 2}
                        y={y - 8}
                        fill="#f97316"
                        fontSize={11}
                        fontWeight="bold"
                        textAnchor="middle"
                        className="opacity-90"
                      >
                        {formatTime(value as number)}
                      </text>
                    );
                  }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="totalTickets"
                  stroke="#6366f1"
                  strokeWidth={3}
                  dot={{ r: 6, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 8, strokeWidth: 0, fill: '#6366f1' }}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Agency Performance Cards */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Detailed Agency Breakdown</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                {agencyPerformanceData.map((agency, index) => {
                  const isExpanded = expandedAgencies.has(agency.name);
                  const toggleExpand = () => {
                    setExpandedAgencies(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(agency.name)) {
                        newSet.delete(agency.name);
                      } else {
                        newSet.add(agency.name);
                      }
                      return newSet;
                    });
                  };

                  // Generate a color based on index (cycling through a palette)
                  const agencyColors = [
                    '#f97316', // orange
                    '#6366f1', // indigo
                    '#14b8a6', // teal
                    '#8b5cf6', // purple
                    '#ec4899', // pink
                    '#10b981', // emerald
                  ];
                  const agencyColor = agencyColors[index % agencyColors.length];

                  return (
                    <div
                      key={agency.name}
                      className="bg-white rounded-2xl shadow-sm border-2 p-4 transition-all hover:shadow-lg"
                      style={{
                        borderLeftWidth: '4px',
                        borderLeftColor: agencyColor,
                        borderTopColor: '#e5e7eb',
                        borderRightColor: '#e5e7eb',
                        borderBottomColor: '#e5e7eb'
                      }}
                    >
                      {/* Compact View - Single Row Layout */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 flex-wrap min-w-0">
                          {/* Agency Name */}
                          <h3 className="font-semibold text-gray-900 text-base flex-shrink-0">{agency.name}</h3>
                          
                          {/* Avg Time */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Clock className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            <span className="text-xs font-medium text-gray-600">Avg Time:</span>
                            <span className="text-xs font-bold text-blue-700">
                              {formatTime(agency.avgTime)}
                            </span>
                          </div>

                          {/* Ticket Count */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="bg-teal-100 text-teal-700 px-2.5 py-1 rounded-full text-xs font-bold">
                              {agency.totalTickets}
                            </span>
                            <span className="text-xs text-gray-600">tickets</span>
                          </div>
                        </div>

                        {/* Dropdown Toggle */}
                        <button
                          onClick={toggleExpand}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-all flex-shrink-0"
                          title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          <ChevronDown 
                            className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </div>

                      {/* Detailed View - Collapsible */}
                      {isExpanded && (
                        <div className="space-y-3 mt-4 pt-4 border-t border-gray-200">
                          {/* Total Time */}
                          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg border border-orange-200">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-orange-600" />
                              <span className="text-sm font-medium text-gray-700">Total Time</span>
                            </div>
                            <span className="text-sm font-bold text-orange-700">
                              {formatTime(agency.totalTime)}
                            </span>
                          </div>

                          {/* Average Time */}
                          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-purple-600" />
                              <span className="text-sm font-medium text-gray-700">Avg Time</span>
                            </div>
                            <span className="text-sm font-bold text-purple-700">
                              {formatTime(agency.avgTime)}
                            </span>
                          </div>

                          {/* Category Breakdown */}
                          {agency.categories.length > 0 && (
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                                Category Breakdown
                              </div>
                              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {agency.categories.map((cat) => (
                                  <div key={cat.category} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <div
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: cat.color }}
                                      />
                                      <span className="text-gray-700 truncate font-medium" title={cat.category}>
                                        {cat.category}
                                      </span>
                                    </div>
                                    <span className="font-bold text-gray-900 ml-2">{cat.count}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Summary Statistics */}
        <div className="bg-gradient-to-br from-blue-50 via-teal-50 to-purple-50 rounded-xl shadow-lg border-2 border-blue-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <CheckCircle2 className="w-6 h-6 text-teal-600" />
            <h3 className="text-xl font-bold text-gray-900">Key Performance Indicators</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Active Categories</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">{summary.length}</div>
              <div className="text-xs text-gray-600">Categories with completed work</div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Total Completed</div>
              <div className="text-4xl font-bold text-teal-600 mb-1">{overallStats.total}</div>
              <div className="text-xs text-gray-600">Tickets successfully resolved</div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Avg Completion</div>
              <div className="text-4xl font-bold text-purple-600 mb-1">
                {summary.length > 0
                  ? formatTime(summary.reduce((acc, cat) => acc + cat.averageTimeHours, 0) / summary.length)
                  : "0h"
                }
              </div>
              <div className="text-xs text-gray-600">Average time across all work</div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Efficiency Rate</div>
              <div className="text-4xl font-bold text-blue-600 mb-1">
                {overallStats.total > 0
                  ? `${((overallStats.source.inHouse / overallStats.total) * 100).toFixed(0)}%`
                  : "0%"
                }
              </div>
              <div className="text-xs text-gray-600">In-house completion rate</div>
            </div>
          </div>
        </div>
      </div>
      {/* Two-Step Ticket Modal: Preview → Edit */}
      {selectedTicket && (() => {
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
              setIsEditMode(false); // Reset edit mode when closing
            }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            
            {!isEditMode ? (
              /* Step 1: Preview/Read-Only View */
              <div
                className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <TicketCard
                  ticket={selectedTicket}
                  onStatusChange={() => {
                    mutate(); // Refresh data if status changes
                  }}
                  categoryColor={
                    summary.find(c => c.category === selectedTicket.category)?.color || 
                    (categoriesData as any[])?.find(c => c.name === selectedTicket.category)?.color
                  }
                  onEditClick={() => setIsEditMode(true)}
                  onExcludeFromSummary={() => toggleExcludeTicket(selectedTicket.ticketId)}
                  isExcludedFromSummary={excludedTicketIds.has(selectedTicket.ticketId)}
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
                      defaultValue={selectedTicket.description}
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
                        defaultValue={selectedTicket.priority}
                        className="w-full px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                      >
                        <option value="HIGH">🔴 High</option>
                        <option value="MEDIUM">🟡 Medium</option>
                        <option value="LOW">🟢 Low</option>
                      </select>
                    </div>

                    {/* Status */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Status
                      </label>
                      <select
                        defaultValue={selectedTicket.status}
                        className="w-full px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                      >
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
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
                        defaultValue={selectedTicket.location || ''}
                        className="w-full px-4 py-3 bg-purple-50 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium"
                      >
                        <option value="">Select Location</option>
                        {locations.map((loc: any) => (
                          <option key={loc._id} value={loc.fullPath || loc.name}>
                            {loc.fullPath || loc.name}
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
                        defaultValue={selectedTicket.agencyName || 'In-House Team'}
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
                        // Collect form data from individual inputs
                        const descriptionEl = document.querySelector('textarea[placeholder="Enter ticket description..."]') as HTMLTextAreaElement;
                        const priorityEl = document.querySelector('select[defaultValue="' + selectedTicket.priority + '"]') as HTMLSelectElement;
                        const statusEl = document.querySelectorAll('select')[3] as HTMLSelectElement; // Status is 4th select
                        const locationEl = document.querySelectorAll('select')[4] as HTMLSelectElement; // Location is 5th select
                        const agencyEl = document.querySelectorAll('select')[5] as HTMLSelectElement; // Agency is 6th select
                        const newNoteEl = document.querySelector('textarea[placeholder="Add a new note..."]') as HTMLTextAreaElement;

                        const updateData: any = {
                          description: descriptionEl?.value || selectedTicket.description,
                          category: editFormData.category,
                          subCategory: editFormData.subCategory,
                          priority: priorityEl?.value || selectedTicket.priority,
                          status: statusEl?.value || selectedTicket.status,
                          location: locationEl?.value || selectedTicket.location,
                          agencyName: agencyEl?.value || selectedTicket.agencyName,
                        };

                        // Add new note if provided
                        if (newNoteEl?.value.trim()) {
                          updateData.newNote = newNoteEl.value.trim();
                        }

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
  );
}
