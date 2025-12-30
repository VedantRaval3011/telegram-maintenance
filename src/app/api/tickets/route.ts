// app/api/tickets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "../../../lib/mongodb";
import { Ticket } from "../../../models/Ticket";
import { Location } from "../../../models/Location";
import { getSession } from "@/lib/auth";

// Helper to get parent ID from either string or populated object
function getParentId(parentLocationId: any): string | null {
  if (!parentLocationId) return null;
  if (typeof parentLocationId === 'string') return parentLocationId;
  if (typeof parentLocationId === 'object' && parentLocationId._id) {
    return parentLocationId._id.toString();
  }
  return null;
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
    const hasSelectedDescendant = selectedIds.some(otherId => 
      otherId !== id && isAncestorOf(id, otherId, locationMap)
    );
    return !hasSelectedDescendant;
  });
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

// Build full path for a location
function buildFullPath(locId: string, locationMap: Map<string, any>): string {
  const pathParts: string[] = [];
  let currentId: string | null = locId;
  
  while (currentId) {
    const loc = locationMap.get(currentId);
    if (loc) {
      pathParts.unshift(loc.name);
      currentId = getParentId(loc.parentLocationId);
    } else {
      break;
    }
  }
  
  return pathParts.join(' → ');
}

export async function GET(request: NextRequest) {
  await connectToDB();
  
  const session = await getSession();
  let tickets = await Ticket.find().sort({ createdAt: -1 }).lean();
  
  // Apply location-based filtering if user has restricted access
  if (session && session.allowedLocationIds && session.allowedLocationIds.length > 0 && !session.isSuperAdmin) {
    // Build location map
    const allLocations = await Location.find({}).lean();
    const locationMap = new Map<string, any>();
    allLocations.forEach((loc: any) => {
      locationMap.set(loc._id.toString(), loc);
    });
    
    // Find the MOST SPECIFIC locations (handles case where admin saves 132, Office, 1-Floor)
    const mostSpecificIds = findMostSpecificLocations(session.allowedLocationIds, locationMap);
    
    // Get all descendants of most specific locations
    const allowedLocationIds = getAllDescendantIds(mostSpecificIds, locationMap);
    
    // Build allowed location paths
    const allowedPaths: string[] = [];
    allowedLocationIds.forEach(locId => {
      allowedPaths.push(buildFullPath(locId, locationMap));
    });
    
    console.log('[TICKETS API] Original selected:', session.allowedLocationIds);
    console.log('[TICKETS API] Most specific:', mostSpecificIds);
    console.log('[TICKETS API] Allowed paths:', allowedPaths);
    
    // Filter tickets
    tickets = tickets.filter((ticket: any) => {
      const ticketLocation = (ticket.location || "").trim();
      if (!ticketLocation) return false;
      
      // Check if ticket location matches any allowed path
      return allowedPaths.some(path => ticketLocation === path);
    });
    
    console.log('[TICKETS API] Filtered tickets count:', tickets.length);
  }
  
  // Remove time details if user has hideTimeDetails restriction
  if (session && session.hideTimeDetails && !session.isSuperAdmin) {
    tickets = tickets.map((ticket: any) => {
      const { createdAt, updatedAt, agencyDate, agencyTime, ...rest } = ticket;
      return {
        ...rest,
        createdAt: null,
        updatedAt: null,
        agencyDate: null,
        agencyTime: null,
      };
    });
  }
  
  return NextResponse.json({ ok: true, data: tickets });
}

export async function POST(req: Request) {
  const body = await req.json();
  await connectToDB();
  const ticket = await Ticket.create(body);
  return NextResponse.json({ ok: true, data: ticket });
}
