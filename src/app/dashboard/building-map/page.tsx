"use client";
import React, { useState, useMemo, useRef, useEffect } from "react";
import useSWR from "swr";
import Navbar from "@/components/Navbar";
import TicketCard from "@/components/TicketCard";
import { useAuth } from "@/contexts/AuthContext";
import {
    Building2,
    MapPin,
    ChevronRight,
    ChevronDown,
    AlertCircle,
    Clock,
    CheckCircle2,
    X,
    List,
    LayoutGrid,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface LocationNode {
    _id: string;
    name: string;
    type: string | null;
    fullPath?: string;
    children: LocationNode[];
    ticketCount: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
}

// Get icon for location
const getFloorIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("terrace")) return "🌿";
    if (lower.includes("outside")) return "🌳";
    if (lower.includes("service")) return "⚙️";
    if (lower.includes("sterile")) return "🧪";
    if (lower.includes("g-floor") || lower.includes("ground")) return "🚪";
    if (lower.includes("warehouse")) return "📦";
    if (lower.includes("office")) return "🏢";
    if (lower.includes("plant")) return "🏭";
    if (lower.includes("canteen")) return "🍽️";
    if (lower.match(/^\d+-floor/i)) return "🏗️";
    return "📍";
};

// Get style for location
const getLocationStyle = (name: string, hasChildren: boolean) => {
    const lower = name.toLowerCase();
    if (lower.includes("terrace")) return { bgClass: "bg-gradient-to-r from-sky-50 to-blue-50", borderClass: "border-sky-200" };
    if (lower.includes("outside")) return { bgClass: "bg-gradient-to-r from-green-50 to-emerald-50", borderClass: "border-green-200" };
    if (lower.includes("service")) return { bgClass: "bg-gradient-to-r from-slate-100 to-gray-100", borderClass: "border-slate-300" };
    if (lower.includes("sterile")) return { bgClass: "bg-gradient-to-r from-violet-50 to-purple-50", borderClass: "border-violet-200" };
    if (lower.includes("g-floor") || lower.includes("ground")) return { bgClass: "bg-gradient-to-r from-amber-50 to-orange-50", borderClass: "border-amber-200" };
    if (lower.includes("warehouse")) return { bgClass: "bg-gradient-to-r from-stone-50 to-zinc-100", borderClass: "border-stone-300" };
    if (lower.includes("office")) return { bgClass: "bg-gradient-to-r from-blue-50 to-indigo-50", borderClass: "border-blue-200" };
    if (lower.includes("plant")) return { bgClass: "bg-gradient-to-r from-gray-100 to-slate-100", borderClass: "border-gray-300" };
    if (lower.includes("canteen")) return { bgClass: "bg-gradient-to-r from-orange-50 to-red-50", borderClass: "border-orange-200" };
    if (lower.match(/^\d+-floor/i)) return { bgClass: "bg-gradient-to-r from-indigo-50 to-blue-50", borderClass: "border-indigo-200" };
    if (hasChildren) return { bgClass: "bg-gradient-to-r from-gray-50 to-slate-50", borderClass: "border-gray-300" };
    return { bgClass: "bg-gradient-to-r from-white to-gray-50", borderClass: "border-gray-200" };
};

// Building card component
function BuildingCard({
    building,
    isSelected,
    onClick,
    selectedPriority,
    onPrioritySelect
}: {
    building: LocationNode;
    isSelected: boolean;
    onClick: () => void;
    selectedPriority: "high" | "medium" | "low" | null;
    onPrioritySelect: (priority: "high" | "medium" | "low") => void;
}) {
    const handlePriorityClick = (e: React.MouseEvent, priority: "high" | "medium" | "low") => {
        e.stopPropagation(); // Prevent building selection when clicking priority
        onPrioritySelect(priority);
    };

    return (
        <div
            onClick={onClick}
            className={`relative p-4 rounded-2xl border-2 transition-all duration-300 text-left hover:shadow-lg hover:scale-[1.02] min-w-[180px] cursor-pointer
                ${isSelected ? "bg-gradient-to-br from-blue-600 to-indigo-700 border-blue-700 text-white shadow-xl scale-[1.02]" : "bg-white border-gray-200 hover:border-blue-300"}`}
        >
            <div className="flex items-center gap-2 mb-2">
                <Building2 className={`w-5 h-5 ${isSelected ? "text-white" : "text-gray-600"}`} />
                <span className={`font-bold text-lg ${isSelected ? "text-white" : "text-gray-800"}`}>{building.name}</span>
            </div>
            {building.ticketCount > 0 ? (
                <div className={`flex flex-col gap-2 ${isSelected ? "text-blue-100" : "text-gray-600"}`}>
                    <span className="text-sm font-medium">{building.ticketCount} Pending</span>
                    {/* Priority Badges - Clickable */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {building.highPriority > 0 && (
                            <button
                                onClick={(e) => handlePriorityClick(e, "high")}
                                className={`px-2 py-0.5 rounded text-xs font-bold transition-all duration-200 hover:scale-110 ${isSelected && selectedPriority === "high"
                                    ? "bg-white text-red-600 ring-2 ring-white"
                                    : isSelected
                                        ? "bg-red-500 text-white hover:bg-red-400"
                                        : selectedPriority === "high"
                                            ? "bg-red-600 text-white ring-2 ring-red-400"
                                            : "bg-red-100 text-red-700 hover:bg-red-200"
                                    }`}
                            >
                                {building.highPriority} High
                            </button>
                        )}
                        {building.mediumPriority > 0 && (
                            <button
                                onClick={(e) => handlePriorityClick(e, "medium")}
                                className={`px-2 py-0.5 rounded text-xs font-bold transition-all duration-200 hover:scale-110 ${isSelected && selectedPriority === "medium"
                                    ? "bg-white text-amber-600 ring-2 ring-white"
                                    : isSelected
                                        ? "bg-amber-500 text-white hover:bg-amber-400"
                                        : selectedPriority === "medium"
                                            ? "bg-amber-600 text-white ring-2 ring-amber-400"
                                            : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                    }`}
                            >
                                {building.mediumPriority} Med
                            </button>
                        )}
                        {building.lowPriority > 0 && (
                            <button
                                onClick={(e) => handlePriorityClick(e, "low")}
                                className={`px-2 py-0.5 rounded text-xs font-bold transition-all duration-200 hover:scale-110 ${isSelected && selectedPriority === "low"
                                    ? "bg-white text-blue-600 ring-2 ring-white"
                                    : isSelected
                                        ? "bg-blue-400 text-white hover:bg-blue-300"
                                        : selectedPriority === "low"
                                            ? "bg-blue-600 text-white ring-2 ring-blue-400"
                                            : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                    }`}
                            >
                                {building.lowPriority} Low
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className={`flex items-center gap-1 text-sm ${isSelected ? "text-green-200" : "text-green-600"}`}>
                    <CheckCircle2 className="w-4 h-4" /><span>All Clear</span>
                </div>
            )}
            <div className={`text-xs mt-2 ${isSelected ? "text-blue-200" : "text-gray-400"}`}>
                {building.children.length} area{building.children.length !== 1 ? "s" : ""}
            </div>
        </div>
    );
}

// Tree View Row
function LocationRow({ location, depth, isSelected, isExpanded, onSelect, onToggle }: {
    location: LocationNode; depth: number; isSelected: boolean; isExpanded: boolean; onSelect: () => void; onToggle: () => void;
}) {
    const hasChildren = location.children.length > 0;
    const style = getLocationStyle(location.name, hasChildren);

    return (
        <div
            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer hover:shadow-md
                ${isSelected ? "ring-2 ring-blue-500 ring-offset-2 border-blue-400 shadow-lg" : style.borderClass} ${style.bgClass}`}
            style={{ marginLeft: depth * 24 }}
            onClick={onSelect}
        >
            {hasChildren ? (
                <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="p-1 rounded hover:bg-black/10">
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-600" /> : <ChevronRight className="w-5 h-5 text-gray-600" />}
                </button>
            ) : <div className="w-7" />}
            <span className="text-xl">{getFloorIcon(location.name)}</span>
            <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-800">{location.name}</div>
                {hasChildren && <div className="text-xs text-gray-500">{location.children.length} sub-locations</div>}
            </div>
            <div className="flex items-center gap-2">
                {location.highPriority > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-lg">
                        <AlertCircle className="w-3 h-3" /><span className="text-xs font-bold">{location.highPriority}</span>
                    </div>
                )}
                {location.mediumPriority > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-lg">
                        <Clock className="w-3 h-3" /><span className="text-xs font-bold">{location.mediumPriority}</span>
                    </div>
                )}
                {location.ticketCount > 0 ? (
                    <div className="px-2.5 py-1 bg-orange-500 text-white rounded-lg font-bold text-xs">{location.ticketCount}</div>
                ) : (
                    <div className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs"><CheckCircle2 className="w-3 h-3" /></div>
                )}
            </div>
        </div>
    );
}

// Visual Building Floor Row
function BuildingFloorRow({ location, isSelected, onClick, floorIndex, totalFloors }: {
    location: LocationNode; isSelected: boolean; onClick: () => void; floorIndex: number; totalFloors: number;
}) {
    const isTopFloor = floorIndex === 0;
    const isBottomFloor = floorIndex === totalFloors - 1;
    const hasHighPriority = location.highPriority > 0;

    return (
        <div
            onClick={onClick}
            className={`flex items-stretch cursor-pointer transition-all duration-200 hover:scale-[1.02]
                ${isSelected ? "z-10 scale-[1.02]" : ""} ${hasHighPriority ? "bg-orange-50" : "bg-white"}`}
        >
            {/* Left - Floor Label */}
            <div className={`w-32 flex-shrink-0 flex flex-col items-center justify-center p-2 border-r-2 border-gray-200
                ${isSelected ? "bg-blue-100" : "bg-gray-50"}`}>
                <span className="text-2xl mb-1">{getFloorIcon(location.name)}</span>
                <span className="font-bold text-xs text-gray-800 text-center leading-tight">{location.name.toUpperCase()}</span>
            </div>

            {/* Center - Building Visual */}
            <div className={`flex-1 relative overflow-hidden ${isSelected ? "ring-2 ring-blue-500 ring-inset" : ""}`}>
                <div className={`h-full min-h-[60px] relative ${isTopFloor ? "bg-gradient-to-b from-sky-200 to-sky-100" : "bg-gradient-to-b from-gray-100 to-white"}`}>
                    <div className="absolute inset-0 flex items-center justify-center gap-3 px-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className={`w-8 h-10 rounded-t-lg border-2 ${isTopFloor ? "bg-sky-300 border-sky-400" : "bg-blue-200 border-blue-300"}`}>
                                <div className="w-1 h-full bg-white/30 ml-1" />
                            </div>
                        ))}
                    </div>
                    {!isBottomFloor && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-400" />}
                    {isBottomFloor && (
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-amber-700 border-2 border-amber-900 rounded-t-lg">
                            <div className="absolute top-3 right-2 w-1.5 h-1.5 bg-yellow-400 rounded-full" />
                        </div>
                    )}
                </div>
            </div>

            {/* Right - Stats */}
            <div className={`w-48 flex-shrink-0 flex flex-col items-center justify-center p-2 border-l-2 border-gray-200 gap-2
                ${isSelected ? "bg-blue-50" : "bg-white"}`}>
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white
                        ${location.ticketCount > 0 ? "bg-orange-500" : "bg-gray-300"}`}>{location.ticketCount}</div>
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white">0</div>
                    <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-xs font-bold text-white">0</div>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>Pending</span><span>Progress</span><span>Done</span>
                </div>
                <div className="text-xs text-gray-600">
                    {location.ticketCount > 0 ? (
                        <span>{location.ticketCount} Pending{location.highPriority > 0 && <span className="text-red-600 font-bold ml-1">| {location.highPriority} High</span>}</span>
                    ) : <span className="text-green-600">All Clear</span>}
                </div>
            </div>
        </div>
    );
}

// Visual Building Component
function VisualBuilding({ building, selectedLocation, onSelectLocation }: {
    building: LocationNode; selectedLocation: string | null; onSelectLocation: (id: string) => void;
}) {
    const allFloors: LocationNode[] = [];
    const flattenLocations = (nodes: LocationNode[]) => {
        nodes.forEach(node => {
            allFloors.push(node);
            if (node.children.length > 0) flattenLocations(node.children);
        });
    };
    flattenLocations(building.children);

    return (
        <div className="relative">
            <div className="text-center text-sm text-gray-600 mb-4">Live overview of pending tickets by location</div>
            <div className="flex items-center mb-2 text-xs text-gray-500 font-semibold uppercase tracking-wide">
                <div className="w-32 text-center">Location</div>
                <div className="flex-1 text-center">Building</div>
                <div className="w-48 text-center">Status</div>
            </div>
            <div className="border-2 border-gray-300 rounded-xl overflow-hidden shadow-lg">
                <div className="bg-gradient-to-b from-gray-400 to-gray-300 p-2 flex justify-center">
                    <div className="flex gap-4">
                        <div className="w-6 h-6 bg-gray-500 rounded" />
                        <div className="w-12 h-4 bg-blue-800 rounded" />
                        <div className="w-6 h-8 bg-gray-600 rounded-t" />
                    </div>
                </div>
                <div className="divide-y-2 divide-gray-200">
                    {allFloors.length > 0 ? allFloors.map((floor, index) => (
                        <BuildingFloorRow key={floor._id} location={floor} isSelected={selectedLocation === floor._id}
                            onClick={() => onSelectLocation(floor._id)} floorIndex={index} totalFloors={allFloors.length} />
                    )) : (
                        <div className="p-8 text-center text-gray-500">
                            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No locations defined</p>
                        </div>
                    )}
                </div>
                <div className="h-6 bg-gradient-to-t from-stone-600 to-stone-500" />
            </div>
            <div className="h-4 bg-gradient-to-b from-green-500 to-green-600 rounded-b-xl mx-4 shadow-inner" />
        </div>
    );
}

export default function BuildingMapPage() {
    const { isReadOnly, hideTimeDetails } = useAuth();
    const { data: hierarchyData, error: hierarchyError } = useSWR("/api/locations/hierarchy", fetcher, { refreshInterval: 5000 });
    const { data: ticketsData, error: ticketsError, mutate } = useSWR("/api/tickets", fetcher, { refreshInterval: 5000 });
    const { data: categoriesData } = useSWR("/api/masters/categories?limit=100", fetcher);

    const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
    const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<"tree" | "building">("tree");
    const [highlightTickets, setHighlightTickets] = useState(false);
    const [selectedPriority, setSelectedPriority] = useState<"high" | "medium" | "low" | null>(null);

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

    // Refs for scrolling
    const treeViewRef = useRef<HTMLDivElement>(null);
    const ticketsPanelRef = useRef<HTMLDivElement>(null);

    const buildings: LocationNode[] = hierarchyData?.data || [];
    const tickets = ticketsData?.data || [];
    const categories = categoriesData?.data || [];

    // Sort buildings by ticketCount (highest problems first)
    const sortedBuildings = useMemo(() => {
        return [...buildings].sort((a, b) => b.ticketCount - a.ticketCount);
    }, [buildings]);

    const currentBuilding = useMemo(() => buildings.find((b) => b._id === selectedBuilding) || null, [buildings, selectedBuilding]);

    // Auto-select building with highest problems on initial load
    useEffect(() => {
        if (sortedBuildings.length > 0 && selectedBuilding === null) {
            const buildingWithMostProblems = sortedBuildings[0];
            setSelectedBuilding(buildingWithMostProblems._id);
            // Also expand its children
            const newExpanded = new Set<string>();
            buildingWithMostProblems.children.forEach(child => {
                if (child.children.length > 0) newExpanded.add(child._id);
            });
            setExpandedLocations(newExpanded);
        }
    }, [sortedBuildings, selectedBuilding]);

    const toggleExpand = (locationId: string) => {
        const newExpanded = new Set(expandedLocations);
        if (newExpanded.has(locationId)) newExpanded.delete(locationId);
        else newExpanded.add(locationId);
        setExpandedLocations(newExpanded);
    };

    const filteredTickets = useMemo(() => {
        if (!selectedLocation && !selectedBuilding) return [];
        const pendingTickets = tickets.filter((t: any) => t.status === "PENDING");
        const getFullPaths = (node: LocationNode): string[] => {
            const paths: string[] = [];
            if (node.fullPath) paths.push(node.fullPath);
            node.children.forEach((child) => paths.push(...getFullPaths(child)));
            return paths;
        };
        const findLocation = (nodes: LocationNode[], id: string): LocationNode | null => {
            for (const node of nodes) {
                if (node._id === id) return node;
                const found = findLocation(node.children, id);
                if (found) return found;
            }
            return null;
        };

        let locationFilteredTickets: any[] = [];

        if (selectedLocation) {
            const location = findLocation(buildings, selectedLocation);
            if (location) locationFilteredTickets = pendingTickets.filter((t: any) => getFullPaths(location).includes(t.location));
        } else if (selectedBuilding && currentBuilding) {
            // Plant-wise view: show all tickets for the building when no specific location is selected
            locationFilteredTickets = pendingTickets.filter((t: any) => getFullPaths(currentBuilding).includes(t.location));
        }

        // Apply priority filter if selected
        if (selectedPriority) {
            return locationFilteredTickets.filter((t: any) => t.priority?.toLowerCase() === selectedPriority);
        }

        return locationFilteredTickets;
    }, [tickets, selectedLocation, selectedBuilding, buildings, currentBuilding, selectedPriority]);

    // Handle building selection - toggle behavior (click again to deselect)
    const handleBuildingSelect = (buildingId: string) => {
        // Toggle: if already selected, deselect it
        if (selectedBuilding === buildingId) {
            setSelectedBuilding(null);
            setSelectedLocation(null);
            setSelectedPriority(null);
            setExpandedLocations(new Set());
            return;
        }

        setSelectedBuilding(buildingId);
        setSelectedLocation(null);
        setSelectedPriority(null); // Clear priority filter when changing buildings
        const building = buildings.find(b => b._id === buildingId);
        if (building) {
            const newExpanded = new Set<string>();
            building.children.forEach(child => { if (child.children.length > 0) newExpanded.add(child._id); });
            setExpandedLocations(newExpanded);
        }
        // Scroll to tree view after a short delay
        setTimeout(() => {
            treeViewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
    };

    // Handle location/floor selection - scroll to tickets and highlight
    const handleLocationSelect = (locationId: string) => {
        setSelectedLocation(locationId);
        setSelectedPriority(null); // Clear priority filter when selecting a location
        // Trigger highlight animation
        setHighlightTickets(true);
        // Scroll to tickets panel after a short delay
        setTimeout(() => {
            ticketsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
        // Remove highlight after animation
        setTimeout(() => {
            setHighlightTickets(false);
        }, 1500);
    };

    // Handle priority selection - filter tickets by priority
    const handlePrioritySelect = (priority: "high" | "medium" | "low") => {
        // Toggle priority filter: clicking the same priority clears it
        if (selectedPriority === priority) {
            setSelectedPriority(null);
        } else {
            setSelectedPriority(priority);
        }
        // Trigger highlight animation
        setHighlightTickets(true);
        // Scroll to tickets panel after a short delay
        setTimeout(() => {
            ticketsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
        // Remove highlight after animation
        setTimeout(() => {
            setHighlightTickets(false);
        }, 1500);
    };

    const renderLocationTree = (locations: LocationNode[], depth = 0) => {
        return locations.map((location) => (
            <div key={location._id} className="space-y-2">
                <LocationRow
                    location={location} depth={depth} isSelected={selectedLocation === location._id}
                    isExpanded={expandedLocations.has(location._id)}
                    onSelect={() => handleLocationSelect(location._id)}
                    onToggle={() => toggleExpand(location._id)}
                />
                {location.children.length > 0 && expandedLocations.has(location._id) && (
                    <div className="space-y-2">{renderLocationTree(location.children, depth + 1)}</div>
                )}
            </div>
        ));
    };

    if (hierarchyError || ticketsError) {
        return <div className="min-h-screen bg-gray-50"><Navbar /><div className="p-10 text-center text-red-500">Failed to load data</div></div>;
    }
    if (!hierarchyData || !ticketsData) {
        return <div className="min-h-screen bg-gray-50"><Navbar /><div className="p-10 text-center text-gray-500 animate-pulse">Loading...</div></div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <Navbar />
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
                {/* Building Selector */}
                <div className="mb-8">
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Select Building</h2>
                    <div className="flex flex-wrap gap-4 overflow-x-auto pb-4 no-scrollbar">
                        {sortedBuildings.map((building) => (
                            <BuildingCard
                                key={building._id}
                                building={building}
                                isSelected={selectedBuilding === building._id}
                                onClick={() => handleBuildingSelect(building._id)}
                                selectedPriority={selectedBuilding === building._id ? selectedPriority : null}
                                onPrioritySelect={(priority) => {
                                    // First select this building if not already selected
                                    if (selectedBuilding !== building._id) {
                                        setSelectedBuilding(building._id);
                                        setSelectedLocation(null);
                                    }
                                    handlePrioritySelect(priority);
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Main Content */}
                <div ref={treeViewRef} className="grid grid-cols-1 lg:grid-cols-2 gap-8 scroll-mt-4">
                    {/* Location View */}
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Building2 className="w-6 h-6 text-blue-600" />
                                {currentBuilding ? currentBuilding.name : "Select a Building"}
                            </h2>
                            <div className="flex items-center gap-2">
                                {selectedLocation && (
                                    <button onClick={() => setSelectedLocation(null)} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200">
                                        <X className="w-4 h-4 text-gray-600" />
                                    </button>
                                )}
                                <div className="flex bg-gray-100 rounded-lg p-1">
                                    <button
                                        onClick={() => setViewMode("tree")}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "tree" ? "bg-white shadow text-blue-600" : "text-gray-600"}`}
                                    >
                                        <List className="w-4 h-4" /> Tree
                                    </button>
                                    <button
                                        onClick={() => setViewMode("building")}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "building" ? "bg-white shadow text-blue-600" : "text-gray-600"}`}
                                    >
                                        <LayoutGrid className="w-4 h-4" /> Building
                                    </button>
                                </div>
                            </div>
                        </div>

                        {currentBuilding ? (
                            <div>
                                {viewMode === "tree" ? (
                                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                                        {currentBuilding.children.length > 0 ? renderLocationTree(currentBuilding.children) : (
                                            <div className="text-center py-8 text-gray-500"><MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No locations defined</p></div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="max-h-[500px] overflow-y-auto pr-2">
                                        <VisualBuilding building={currentBuilding} selectedLocation={selectedLocation} onSelectLocation={handleLocationSelect} />
                                    </div>
                                )}
                                {/* Stats - Clickable Priority Filters */}
                                <div className="grid grid-cols-3 gap-3 mt-6 pt-4 border-t border-gray-200">
                                    <button
                                        onClick={() => handlePrioritySelect("high")}
                                        className={`rounded-xl p-3 text-center border transition-all duration-200 cursor-pointer hover:scale-105 hover:shadow-md ${selectedPriority === "high"
                                            ? "bg-red-500 border-red-600 ring-2 ring-red-400 ring-offset-2"
                                            : "bg-red-50 border-red-100 hover:bg-red-100"
                                            }`}
                                    >
                                        <div className={`text-2xl font-bold ${selectedPriority === "high" ? "text-white" : "text-red-600"}`}>
                                            {currentBuilding.highPriority}
                                        </div>
                                        <div className={`text-xs font-medium ${selectedPriority === "high" ? "text-red-100" : "text-red-600"}`}>
                                            High {selectedPriority === "high" && "✓"}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => handlePrioritySelect("medium")}
                                        className={`rounded-xl p-3 text-center border transition-all duration-200 cursor-pointer hover:scale-105 hover:shadow-md ${selectedPriority === "medium"
                                            ? "bg-amber-500 border-amber-600 ring-2 ring-amber-400 ring-offset-2"
                                            : "bg-amber-50 border-amber-100 hover:bg-amber-100"
                                            }`}
                                    >
                                        <div className={`text-2xl font-bold ${selectedPriority === "medium" ? "text-white" : "text-amber-600"}`}>
                                            {currentBuilding.mediumPriority}
                                        </div>
                                        <div className={`text-xs font-medium ${selectedPriority === "medium" ? "text-amber-100" : "text-amber-600"}`}>
                                            Medium {selectedPriority === "medium" && "✓"}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => handlePrioritySelect("low")}
                                        className={`rounded-xl p-3 text-center border transition-all duration-200 cursor-pointer hover:scale-105 hover:shadow-md ${selectedPriority === "low"
                                            ? "bg-blue-500 border-blue-600 ring-2 ring-blue-400 ring-offset-2"
                                            : "bg-blue-50 border-blue-100 hover:bg-blue-100"
                                            }`}
                                    >
                                        <div className={`text-2xl font-bold ${selectedPriority === "low" ? "text-white" : "text-blue-600"}`}>
                                            {currentBuilding.lowPriority}
                                        </div>
                                        <div className={`text-xs font-medium ${selectedPriority === "low" ? "text-blue-100" : "text-blue-600"}`}>
                                            Low {selectedPriority === "low" && "✓"}
                                        </div>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-16 text-gray-500">
                                <Building2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                <p className="text-lg font-medium">Select a building to view its structure</p>
                            </div>
                        )}
                    </div>

                    {/* Tickets Panel */}
                    <div ref={ticketsPanelRef} className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 scroll-mt-4">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                                <MapPin className="w-6 h-6 text-orange-500" />
                                Pending Tickets
                                {selectedPriority && (
                                    <button
                                        onClick={() => setSelectedPriority(null)}
                                        className={`px-2 py-0.5 rounded-full text-sm font-bold flex items-center gap-1 transition-all hover:scale-105 ${selectedPriority === "high" ? "bg-red-500 text-white" :
                                            selectedPriority === "medium" ? "bg-amber-500 text-white" :
                                                "bg-blue-500 text-white"
                                            }`}
                                    >
                                        {selectedPriority.charAt(0).toUpperCase() + selectedPriority.slice(1)} Priority
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                                {filteredTickets.length > 0 && (
                                    <span className={`px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-sm font-bold transition-all ${highlightTickets ? "animate-pulse scale-125" : ""}`}>
                                        {filteredTickets.length}
                                    </span>
                                )}
                            </h2>
                        </div>
                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                            {filteredTickets.length > 0 ? (
                                filteredTickets.map((ticket: any, index: number) => {
                                    const cat = categories.find((c: any) => c.name.toLowerCase() === (ticket.category || "").toLowerCase());
                                    return (
                                        <div
                                            key={ticket.ticketId}
                                            className={`transition-all duration-300 ${highlightTickets ? "animate-pulse ring-2 ring-orange-400 ring-offset-2 rounded-xl" : ""}`}
                                            style={{ animationDelay: `${index * 100}ms` }}
                                        >
                                            <TicketCard 
                                                ticket={ticket} 
                                                onStatusChange={() => mutate()} 
                                                categoryColor={cat?.color} 
                                                onExcludeFromSummary={() => toggleExcludeTicket(ticket.ticketId)}
                                                isExcludedFromSummary={excludedTicketIds.has(ticket.ticketId)}
                                                isReadOnly={isReadOnly}
                                                hideTimeDetails={hideTimeDetails}
                                            />
                                        </div>
                                    );
                                })
                            ) : selectedBuilding || selectedLocation ? (
                                <div className="text-center py-16 text-gray-500">
                                    <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-400 opacity-50" />
                                    <p className="text-lg font-medium text-green-600">All Clear!</p>
                                    <p className="text-sm mt-1">No pending tickets for this location</p>
                                </div>
                            ) : (
                                <div className="text-center py-16 text-gray-500">
                                    <MapPin className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                    <p className="text-lg font-medium">Select a location</p>
                                    <p className="text-sm mt-1">Choose a building or location to view tickets</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
