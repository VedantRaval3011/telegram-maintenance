"use client";
import React, { useMemo } from "react";
import useSWR from "swr";
import Navbar from "@/components/Navbar";
import Capsule from "@/components/Capsule";
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
} from "recharts";
import { Clock, TrendingUp, CheckCircle2, BarChart3, PieChart as PieChartIcon, Info, Activity } from "lucide-react";

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

export default function SummaryPage() {
  const { data: tickets = [], error, isLoading } = useSWR<Ticket[]>("/api/tickets", fetcher, { refreshInterval: 3000 });
  const { data: categoriesData } = useSWR("/api/masters/categories?limit=100", (url: string) => 
    fetch(url).then(r => r.json()));

  const categories = categoriesData?.data || [];

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
    
    return {
      total: completedTickets.length,
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

  // Prepare chart data
  const barChartData = summary.map(cat => ({
    name: cat.displayName,
    completed: cat.totalCompleted,
    avgTime: parseFloat(cat.averageTimeHours.toFixed(1)),
    color: cat.color,
  }));

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
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Info className="w-4 h-4" />
              <span>Detailed metrics for each category</span>
            </div>
          </div>
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
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                        <span className="text-gray-700 font-medium">High: {cat.priority.high}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        <span className="text-gray-700 font-medium">Med: {cat.priority.medium}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
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
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Charts Section */}
        <div className="space-y-6 mb-12">
          {/* Completion by Category - Bar Chart */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Completion Volume by Category</h3>
              </div>
              <p className="text-sm text-gray-600">
                Total number of completed tickets across all categories. Higher bars indicate more work completed in that category.
              </p>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12, fill: '#4b5563' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#4b5563' }}
                  label={{ value: 'Number of Tickets', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#4b5563' } }}
                />
                <Tooltip content={<CustomTooltip formatter={(value: number) => `${value} tickets`} />} />
                <Legend 
                  wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                  iconType="square"
                />
                <Bar 
                  dataKey="completed" 
                  name="Completed Tickets" 
                  radius={[8, 8, 0, 0]}
                  label={{ position: 'top', fontSize: 11, fill: '#374151', fontWeight: 'bold' }}
                >
                  {barChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Average Time by Category - Line Chart */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">Average Completion Time Trend</h3>
              </div>
              <p className="text-sm text-gray-600">
                Average time taken to complete work in each category. Lower values indicate faster completion times and better efficiency.
              </p>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12, fill: '#4b5563' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#4b5563' }}
                  label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#4b5563' } }}
                />
                <Tooltip content={<CustomTooltip formatter={(value: number) => `${value} hours`} />} />
                <Legend 
                  wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                  iconType="line"
                />
                <Line 
                  type="monotone" 
                  dataKey="avgTime" 
                  name="Average Time (hours)"
                  stroke="#9333ea" 
                  strokeWidth={3}
                  dot={{ fill: '#9333ea', r: 6, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 8 }}
                  label={{ position: 'top', fontSize: 11, fill: '#7e22ce', fontWeight: 'bold' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
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
    </div>
  );
}
