// app/api/locations/hierarchy/route.ts
import { NextResponse } from "next/server";
import { Location } from "@/models/Location";
import { Ticket } from "@/models/Ticket";
import { connectToDB } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";

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

// Helper to get parent ID from either string or populated object
function getParentId(parentLocationId: any): string | null {
  if (!parentLocationId) return null;
  if (typeof parentLocationId === 'string') return parentLocationId;
  if (typeof parentLocationId === 'object' && parentLocationId._id) {
    return parentLocationId._id.toString();
  }
  return null;
}

// Helper function to get all descendant location IDs
function getAllDescendantIds(parentIds: string[], locationMap: Map<string, any>): Set<string> {
  const result = new Set<string>(parentIds);
  const queue = [...parentIds];
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    
    locationMap.forEach((loc, locId) => {
      const parentId = getParentId(loc.parentLocationId);
      if (parentId === currentId && !result.has(locId)) {
        result.add(locId);
        queue.push(locId);
      }
    });
  }
  
  return result;
}

// Helper to check if locationA is an ancestor of locationB
function isAncestorOf(ancestorId: string, descendantId: string, locationMap: Map<string, any>): boolean {
  let currentId: string | null = descendantId;
  
  while (currentId) {
    const current = locationMap.get(currentId);
    if (!current) break;
    
    const parentId = getParentId(current.parentLocationId);
    if (parentId === ancestorId) return true;
    currentId = parentId;
  }
  
  return false;
}

// Find the most specific (deepest) locations - those that don't have any descendants also selected
function findMostSpecificLocations(selectedIds: string[], locationMap: Map<string, any>): string[] {
  return selectedIds.filter(id => {
    // Check if any other selected ID is a descendant of this one
    const hasSelectedDescendant = selectedIds.some(otherId => 
      otherId !== id && isAncestorOf(id, otherId, locationMap)
    );
    return !hasSelectedDescendant;
  });
}

// Helper to get all ancestor IDs up to root
function getAllAncestorIds(locationId: string, locationMap: Map<string, any>): string[] {
  const ancestors: string[] = [];
  let current = locationMap.get(locationId);
  
  while (current) {
    const parentId = getParentId(current.parentLocationId);
    if (parentId && locationMap.has(parentId)) {
      ancestors.push(parentId);
      current = locationMap.get(parentId);
    } else {
      break;
    }
  }
  
  return ancestors;
}

/**
 * GET /api/locations/hierarchy
 * Returns location hierarchy with ticket counts per location
 * Filtered based on user's allowed locations
 */
export async function GET() {
  try {
    await connectToDB();

    const session = await getSession();
    const locations = await Location.find({ isActive: true }).lean();
    const pendingTickets = await Ticket.find({ status: "PENDING" }).lean();

    // Build complete location map
    const allLocationMap = new Map<string, any>();
    locations.forEach((loc: any) => {
      allLocationMap.set(loc._id.toString(), {
        ...loc,
        _id: loc._id.toString(),
      });
    });

    // Check if user has location restrictions
    if (session && session.allowedLocationIds && session.allowedLocationIds.length > 0 && !session.isSuperAdmin) {
      // Find the MOST SPECIFIC locations (deepest in hierarchy)
      // This handles the case where admin UI saves 132, Office, 1-Floor but user only wanted 1-Floor
      const mostSpecificIds = findMostSpecificLocations(session.allowedLocationIds, allLocationMap);
      
      console.log('[HIERARCHY API] Original selected:', session.allowedLocationIds);
      console.log('[HIERARCHY API] Most specific (deepest):', mostSpecificIds);
      
      // Get descendants of most specific locations only
      const allowedWithDescendants = getAllDescendantIds(mostSpecificIds, allLocationMap);
      
      // Get ancestors for tree structure (path to root)
      const ancestorsForPath = new Set<string>();
      mostSpecificIds.forEach(id => {
        getAllAncestorIds(id, allLocationMap).forEach(aid => ancestorsForPath.add(aid));
      });
      
      console.log('[HIERARCHY API] Allowed with descendants:', allowedWithDescendants.size);
      console.log('[HIERARCHY API] Ancestors for path:', ancestorsForPath.size);

      // Build filtered location map
      const locationMap = new Map<string, any>();
      
      // Add allowed locations (most specific + their descendants)
      allowedWithDescendants.forEach(locId => {
        const loc = allLocationMap.get(locId);
        if (loc) {
          locationMap.set(locId, {
            ...loc,
            children: [],
            ticketCount: 0,
            highPriority: 0,
            mediumPriority: 0,
            lowPriority: 0,
            fullPath: "",
            isActuallyAllowed: true,
          });
        }
      });
      
      // Add ancestors for navigation path
      ancestorsForPath.forEach(locId => {
        if (!locationMap.has(locId)) {
          const loc = allLocationMap.get(locId);
          if (loc) {
            locationMap.set(locId, {
              ...loc,
              children: [],
              ticketCount: 0,
              highPriority: 0,
              mediumPriority: 0,
              lowPriority: 0,
              fullPath: "",
              isActuallyAllowed: false, // Just for navigation
            });
          }
        }
      });

      // Build parent-child relationships
      const roots: LocationNode[] = [];
      
      locationMap.forEach((loc) => {
        const parentId = getParentId(loc.parentLocationId);
        
        if (parentId && locationMap.has(parentId)) {
          locationMap.get(parentId)!.children.push(loc);
        } else {
          roots.push(loc);
        }
      });

      // Build full paths using original all locations map
      const buildFullPath = (locId: string): string => {
        const pathParts: string[] = [];
        let currentId: string | null = locId;
        
        while (currentId) {
          const loc = allLocationMap.get(currentId);
          if (loc) {
            pathParts.unshift(loc.name);
            currentId = getParentId(loc.parentLocationId);
          } else {
            break;
          }
        }
        
        return pathParts.join(' → ');
      };
      
      locationMap.forEach((loc) => {
        loc.fullPath = buildFullPath(loc._id);
      });

      // Match tickets to locations
      pendingTickets.forEach((ticket: any) => {
        const ticketLoc = (ticket.location || "").trim();
        if (!ticketLoc) return;

        locationMap.forEach((loc) => {
          if (loc.isActuallyAllowed && ticketLoc === loc.fullPath) {
            loc.ticketCount++;
            const priority = (ticket.priority || "").toLowerCase();
            if (priority === "high") loc.highPriority++;
            else if (priority === "medium") loc.mediumPriority++;
            else if (priority === "low") loc.lowPriority++;
          }
        });
      });

      // Sort children
      const floorOrder = (name: string): number => {
        const lower = name.toLowerCase();
        if (lower.includes("terrace")) return 0;
        if (lower.includes("outside")) return 100;
        if (lower.match(/^\d+-floor/)) {
          const num = parseInt(lower.match(/^(\d+)/)?.[1] || "0");
          if (lower.includes("service")) return 50 + num;
          if (lower.includes("sterile")) return 30 + num;
          return 10 + (10 - num);
        }
        if (lower.includes("g-floor") || lower.includes("ground")) {
          if (lower.includes("service")) return 60;
          if (lower.includes("sterile")) return 55;
          return 40;
        }
        if (lower.includes("office")) return 20;
        if (lower.includes("service")) return 70;
        if (lower.includes("basement") || lower.includes("parking")) return 80;
        return 50;
      };

      const sortChildren = (node: LocationNode) => {
        node.children.sort((a, b) => floorOrder(a.name) - floorOrder(b.name));
        node.children.forEach(sortChildren);
      };

      roots.sort((a, b) => a.name.localeCompare(b.name));
      roots.forEach(sortChildren);

      // Aggregate counts bottom-up
      const aggregateCounts = (node: LocationNode) => {
        node.children.forEach(aggregateCounts);
        node.children.forEach(child => {
          node.ticketCount += child.ticketCount;
          node.highPriority += child.highPriority;
          node.mediumPriority += child.mediumPriority;
          node.lowPriority += child.lowPriority;
        });
      };
      roots.forEach(aggregateCounts);

      return NextResponse.json({ success: true, data: roots });
    }

    // No restrictions - show all (original logic)
    const locationMap = new Map<string, any>();
    locations.forEach((loc: any) => {
      locationMap.set(loc._id.toString(), {
        ...loc,
        _id: loc._id.toString(),
        children: [],
        ticketCount: 0,
        highPriority: 0,
        mediumPriority: 0,
        lowPriority: 0,
        fullPath: "",
      });
    });

    const roots: LocationNode[] = [];
    locationMap.forEach((loc) => {
      const parentId = getParentId(loc.parentLocationId);
      if (parentId && locationMap.has(parentId)) {
        locationMap.get(parentId)!.children.push(loc);
      } else {
        roots.push(loc);
      }
    });

    const buildPaths = (node: any, parentPath: string = ""): void => {
      node.fullPath = parentPath ? `${parentPath} → ${node.name}` : node.name;
      node.children.forEach((child: any) => buildPaths(child, node.fullPath));
    };
    roots.forEach((root) => buildPaths(root, ""));

    pendingTickets.forEach((ticket: any) => {
      const ticketLoc = (ticket.location || "").trim();
      if (!ticketLoc) return;
      locationMap.forEach((loc) => {
        if (ticketLoc === loc.fullPath) {
          loc.ticketCount++;
          const priority = (ticket.priority || "").toLowerCase();
          if (priority === "high") loc.highPriority++;
          else if (priority === "medium") loc.mediumPriority++;
          else if (priority === "low") loc.lowPriority++;
        }
      });
    });

    const floorOrder = (name: string): number => {
      const lower = name.toLowerCase();
      if (lower.includes("terrace")) return 0;
      if (lower.includes("outside")) return 100;
      if (lower.match(/^\d+-floor/)) {
        const num = parseInt(lower.match(/^(\d+)/)?.[1] || "0");
        if (lower.includes("service")) return 50 + num;
        if (lower.includes("sterile")) return 30 + num;
        return 10 + (10 - num);
      }
      if (lower.includes("g-floor") || lower.includes("ground")) {
        if (lower.includes("service")) return 60;
        if (lower.includes("sterile")) return 55;
        return 40;
      }
      if (lower.includes("office")) return 20;
      if (lower.includes("service")) return 70;
      if (lower.includes("basement") || lower.includes("parking")) return 80;
      return 50;
    };

    const sortChildren = (node: LocationNode) => {
      node.children.sort((a, b) => floorOrder(a.name) - floorOrder(b.name));
      node.children.forEach(sortChildren);
    };
    roots.sort((a, b) => a.name.localeCompare(b.name));
    roots.forEach(sortChildren);

    const aggregateCounts = (node: LocationNode) => {
      node.children.forEach(aggregateCounts);
      node.children.forEach(child => {
        node.ticketCount += child.ticketCount;
        node.highPriority += child.highPriority;
        node.mediumPriority += child.mediumPriority;
        node.lowPriority += child.lowPriority;
      });
    };
    roots.forEach(aggregateCounts);

    return NextResponse.json({ success: true, data: roots });
  } catch (err) {
    console.error("[API] Failed to fetch location hierarchy:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
