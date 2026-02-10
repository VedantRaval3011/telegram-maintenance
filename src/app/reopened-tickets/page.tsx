"use client";
import React, { useState, useMemo } from "react";
import useSWR from "swr";
import Navbar from "@/components/Navbar";
import { 
  History, Clock, User, MessageCircle, AlertCircle, 
  ArrowRight, CheckCircle2, Search, Filter, Calendar
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ReopenedTicketsPage() {
  const { data, isLoading } = useSWR("/api/tickets", fetcher, { refreshInterval: 5000 });
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "duration">("recent");

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  };

  const reopenedTickets = useMemo(() => {
    if (!data?.data || !Array.isArray(data.data)) return [];
    
    return data.data
      .filter((ticket: any) => (ticket.reopenedHistory?.length || 0) > 0)
      .filter((ticket: any) => {
        const search = searchTerm.toLowerCase();
        return (
          (ticket.ticketId || "").toLowerCase().includes(search) ||
          (ticket.description || "").toLowerCase().includes(search) ||
          (ticket.category || "").toLowerCase().includes(search) ||
          (ticket.reopenedHistory || []).some((h: any) => (h.reopenedReason || "").toLowerCase().includes(search))
        );
      })
      .sort((a: any, b: any) => {
        if (sortBy === "recent") {
          const aLast = a.reopenedHistory[a.reopenedHistory.length - 1].reopenedAt;
          const bLast = b.reopenedHistory[b.reopenedHistory.length - 1].reopenedAt;
          return new Date(bLast).getTime() - new Date(aLast).getTime();
        } else {
          // Sort by total duration (createdAt to now or completedAt)
          const aStart = new Date(a.createdAt).getTime();
          const bStart = new Date(b.createdAt).getTime();
          return bStart - aStart;
        }
      });
  }, [data, searchTerm, sortBy]);

  const formatDuration = (ms: number) => {
    if (!ms) return "N/A";
    const hoursTotal = ms / (1000 * 60 * 60);
    if (hoursTotal >= 24) {
      return `${hoursTotal.toFixed(1)}d (${Math.floor(hoursTotal)}h)`;
    }
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 pb-12">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <History className="w-8 h-8 text-indigo-600" />
                Reopened Tickets
              </h1>
              <p className="text-gray-500 mt-1">
                Track tickets that required multiple intervention cycles and analyze reopening reasons.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tickets..."
                  className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full md:w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
              >
                <option value="recent">Most Recent</option>
                <option value="duration">Longest Open</option>
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-500 font-medium">Loading ticket history...</p>
          </div>
        ) : reopenedTickets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-20 text-center shadow-sm">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No Reopened Tickets Found</h3>
            <p className="text-gray-500 mt-2 max-w-sm mx-auto">
              {searchTerm 
                ? "No tickets match your search criteria." 
                : `Great news! No tickets have been reopened yet (Checked ${data?.data?.length || 0} total tickets).`}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {reopenedTickets.map((ticket: any) => (
              <div key={ticket._id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/30 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                      #{ticket.ticketId}
                    </span>
                    <h2 className="text-base font-bold text-gray-900">{ticket.description}</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      ticket.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {ticket.status}
                    </span>
                    <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Created {formatDate(ticket.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Lifecycle Summary */}
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-500" />
                        Ticket Lifecycle
                      </h3>
                      <div className="space-y-4">
                        {/* Original Cycle */}
                        <div className="flex items-start gap-4">
                          <div className="flex flex-col items-center pt-1">
                            <div className="w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-indigo-100"></div>
                            <div className="w-0.5 h-12 bg-gray-100"></div>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-gray-900">Original Creation</div>
                            <div className="text-[11px] text-gray-500">{formatDate(ticket.createdAt)}</div>
                            <div className="text-[11px] font-medium text-indigo-600 mt-0.5">By {ticket.createdBy}</div>
                          </div>
                        </div>

                        {/* Reopening Cycles */}
                        {ticket.reopenedHistory.map((history: any, idx: number) => (
                          <React.Fragment key={idx}>
                            <div className="flex items-start gap-4">
                              <div className="flex flex-col items-center pt-1">
                                <div className="w-3 h-3 rounded-full bg-amber-500 ring-4 ring-amber-100"></div>
                                <div className="w-0.5 h-12 bg-gray-100"></div>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs font-bold text-gray-900">Reopened (Cycle {idx + 1})</div>
                                  <div className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                    Phase Duration: {formatDuration(history.phaseDuration)}
                                  </div>
                                </div>
                                <div className="text-[11px] text-gray-500">{formatDate(history.reopenedAt)}</div>
                                <div className="text-[11px] font-medium text-amber-700 mt-0.5">By {history.reopenedBy}</div>
                                {history.reopenedReason && (
                                  <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded-lg italic border-l-2 border-amber-400">
                                    "{history.reopenedReason}"
                                  </div>
                                )}
                              </div>
                            </div>

                            {history.completedAtAfterReopening && (
                              <div className="flex items-start gap-4">
                                <div className="flex flex-col items-center pt-1">
                                  <div className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100"></div>
                                  <div className={idx < ticket.reopenedHistory.length - 1 ? "w-0.5 h-12 bg-gray-100" : ""}></div>
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-gray-900">Completed After Reopening</div>
                                  <div className="text-[11px] text-gray-500">{formatDate(history.completedAtAfterReopening)}</div>
                                  <div className="text-[11px] font-medium text-emerald-700 mt-0.5">By {history.completedByAfterReopening || "System"}</div>
                                </div>
                              </div>
                            )}
                          </React.Fragment>
                        ))}

                        {/* Current Status if pending */}
                        {ticket.status === "PENDING" && (
                          <div className="flex items-start gap-4">
                            <div className="flex flex-col items-center pt-1">
                              <div className="w-3 h-3 rounded-full bg-gray-300 animate-pulse ring-4 ring-gray-100"></div>
                            </div>
                            <div>
                              <div className="text-xs font-bold text-gray-400 italic">Currently in work...</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metadata & Stats */}
                    <div className="lg:border-l lg:pl-8 border-gray-100">
                      <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-indigo-500" />
                        Ticket Details
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-gray-50 rounded-xl">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Category</div>
                          <div className="text-sm font-bold text-gray-800">{ticket.category || "None"}</div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-xl">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Agency</div>
                          <div className="text-sm font-bold text-gray-800">{ticket.agencyName || "Internal"}</div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-xl">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Cycles</div>
                          <div className="text-sm font-bold text-indigo-600">{1 + ticket.reopenedHistory.length}</div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-xl">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Priority</div>
                          <div className={`text-sm font-bold uppercase ${
                            ticket.priority === 'high' ? 'text-red-600' : 
                            ticket.priority === 'medium' ? 'text-amber-600' : 'text-blue-600'
                          }`}>
                            {ticket.priority}
                          </div>
                        </div>
                      </div>

                      <div className="mt-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-900">Total Resolution Time</span>
                          {ticket.completedAt && (
                            <span className="text-xs font-black text-indigo-600">
                              {formatDuration(new Date(ticket.completedAt).getTime() - new Date(ticket.createdAt).getTime())}
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-indigo-500 h-full w-[100%]"></div>
                        </div>
                      </div>
                      
                      <div className="mt-8">
                        <button 
                          onClick={() => window.location.href=`/dashboard?name=${ticket.ticketId}&status=${ticket.status}`}
                          className="w-full py-3 bg-white border border-indigo-200 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                        >
                          View in Dashboard
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
