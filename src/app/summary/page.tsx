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
} from "recharts";
import { Clock, TrendingUp, CheckCircle2, BarChart3, PieChart as PieChartIcon, Info, Activity, Minimize2, Maximize2 } from "lucide-react";

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

  const categories = categoriesData?.data || [];

  // State for filtering subcategory charts by category
  const [selectedSubCategoryFilter, setSelectedSubCategoryFilter] = useState<string>('all');

  // State for collapsible sections
  const [expandedSections, setExpandedSections] = useState({
    categoryPerformance: false, // Minimized by default
    completionVolume: true,
    avgTimeCategory: true,
    avgTimeSubcategory: true,
  });

  // State for selected ticket modal
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const selectedTicket = tickets.find((t: any) => t.ticketId === selectedTicketId);
  
  // State for stable subcategory tooltip
  const [activeTooltip, setActiveTooltip] = useState<{
    data: any;
    pos: { x: number; y: number };
    chartId: string;
  } | null>(null);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
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
      (t) => t.status === "COMPLETED" && t.completedAt && t.createdAt
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
      if (ticket.agencyName) {
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
  }, [tickets, categories]);

  // Calculate overall stats
  const overallStats = useMemo(() => {
    if (!Array.isArray(tickets)) {
      return { total: 0, priority: { high: 0, medium: 0, low: 0 }, source: { inHouse: 0, outsource: 0 } };
    }

    const completedTickets = tickets.filter(t => t.status === "COMPLETED");
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
        inHouse: completedTickets.filter(t => !t.agencyName).length,
        outsource: completedTickets.filter(t => t.agencyName).length,
      }
    };
  }, [tickets]);

  // Calculate subcategory breakdown for each category (count, avg time, and ticket IDs)
  const subcategoryBreakdown = useMemo(() => {
    if (!Array.isArray(tickets)) return new Map();

    const completedTickets = tickets.filter(
      (t) => t.status === "COMPLETED" && t.completedAt && t.createdAt
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
  }, [tickets]);

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
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Work Summary & Analytics</h1>
          <p className="text-gray-600">
            Comprehensive performance metrics and insights for completed maintenance work
          </p>
        </div>

        {/* Overall Stats Capsule */}
        <div className="mb-12">
          <Capsule
            title="Total Completed Work"
            {...overallStats}
            color="#14b8a6"
          />
        </div>

        {/* Category Summary Cards */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Category Performance Overview
            </h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Info className="w-4 h-4" />
                <span>Detailed metrics for each category</span>
              </div>
              <button
                onClick={() => toggleSection('categoryPerformance')}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-all"
                title={expandedSections.categoryPerformance ? 'Minimize' : 'Expand'}
              >
                {expandedSections.categoryPerformance ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {expandedSections.categoryPerformance && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {summary.map((cat) => (
                <div
                  key={cat.category}
                  className="bg-white rounded-2xl shadow-sm border-2 p-6 transition-all hover:shadow-lg hover:scale-[1.02]"
                  style={{
                    borderLeftWidth: '4px',
                    borderLeftColor: cat.color,
                    borderTopColor: '#e5e7eb',
                    borderRightColor: '#e5e7eb',
                    borderBottomColor: '#e5e7eb'
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 text-lg">{cat.displayName}</h3>
                    <div className="flex flex-col items-end gap-1">
                      <span className="bg-teal-100 text-teal-700 px-3 py-1 rounded-full text-sm font-bold">
                        {cat.totalCompleted}
                      </span>
                      <span className="text-xs text-gray-500">tickets</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* Average Time */}
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-700">Avg Time</span>
                      </div>
                      <span className="text-sm font-bold text-blue-700">
                        {formatTime(cat.averageTimeHours)}
                      </span>
                    </div>

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
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Charts Section */}
        <div className="space-y-6 mb-12">
          {/* Completion Trends - Area Chart */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-teal-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Completion Trends</h3>
                </div>
                <div className="flex items-center gap-2 bg-teal-50 px-4 py-2 rounded-lg border border-teal-200">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  <span className="text-sm font-semibold text-teal-900">Total Completed: {overallStats.total}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                A performance matrix comparing total tickets completed (Bars) against average resolution time (Line).
              </p>
            </div>
            <ResponsiveContainer width="100%" height={450}>
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
                        <div className="bg-white p-5 rounded-xl shadow-2xl border border-slate-200 min-w-[240px]">
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
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Average Completion Time by Category</h3>
                </div>
                <div className="flex items-center gap-2 bg-purple-50 px-4 py-2 rounded-lg border border-purple-200">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-semibold text-purple-900">
                    Overall Avg: {summary.length > 0
                      ? formatTime(summary.reduce((acc, cat) => acc + cat.averageTimeHours, 0) / summary.length)
                      : "0h"
                    }
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Average time taken to complete tickets in each category. Lower bars indicate faster completion. Click on a category bar to see subcategory breakdown.
              </p>
            </div>
            <ResponsiveContainer width="100%" height={550}>
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
                <div className="space-y-8">
                    {subcategoryAvgTimeData
                      .filter(catData => selectedSubCategoryFilter === 'all' || catData.category === selectedSubCategoryFilter)
                      .map((catData) => (
                  <div key={catData.category} className="bg-gray-50/50 rounded-xl border border-gray-100 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div
                        className="w-4 h-4 rounded-full shadow-sm"
                        style={{ backgroundColor: catData.color }}
                      />
                      <h5 className="font-bold text-gray-900 text-lg">
                        {catData.displayName}
                        <span className="ml-2 text-sm font-normal text-gray-500">
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
                      <ResponsiveContainer width="100%" height={Math.max(180, catData.subcategories.length * 50)}>
                        <BarChart
                          data={catData.subcategories}
                          layout="vertical"
                          margin={{ top: 5, right: 80, left: 100, bottom: 5 }}
                          barCategoryGap="20%"
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                          <XAxis type="number" hide />
                          <YAxis
                            dataKey="name"
                            type="category"
                            width={90}
                            tick={{ fontSize: 11, fill: '#4b5563', fontWeight: 500 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Bar
                            dataKey="avgTime"
                            fill={catData.color}
                            radius={[0, 8, 8, 0]}
                            barSize={32}
                            isAnimationActive={false}
                            style={{ cursor: 'pointer', transition: 'filter 0.3s' }}
                            onMouseEnter={(data: any) => {
                              if (data) {
                                setActiveTooltip({
                                  data: data.payload,
                                  pos: { x: data.x + data.width, y: data.y + data.height / 2 },
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
                                  x={x + width + 8}
                                  y={y + 20}
                                  fill={catData.color}
                                  fontSize={10}
                                  fontWeight="bold"
                                  className="opacity-80 pointer-events-none"
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
                ))}
                  </div>
                </div>
              )}
            </div>



          {/* Pie Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Work Distribution - Pie Chart */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <PieChartIcon className="w-5 h-5 text-teal-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Work Distribution by Category</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Percentage breakdown of completed work across different categories. Shows which categories receive the most attention.
                </p>
              </div>
              <ResponsiveContainer width="100%" height={320}>
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
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5 text-red-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Priority Level Distribution</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Distribution of completed tickets by priority level. Helps identify the urgency profile of completed work.
                </p>
              </div>
              <ResponsiveContainer width="100%" height={320}>
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
      {/* Ticket Details Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" onClick={() => setSelectedTicketId(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <TicketCard
              ticket={selectedTicket}
              onStatusChange={() => {
                // Refresh data if status changes
                mutate();
              }}
              categoryColor={
                summary.find(c => c.category === selectedTicket.category)?.color || 
                (categoriesData as any[])?.find(c => c.name === selectedTicket.category)?.color
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
