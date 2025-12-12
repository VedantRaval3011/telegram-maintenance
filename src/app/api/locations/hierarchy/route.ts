// app/api/locations/hierarchy/route.ts
import { NextResponse } from "next/server";
import { Location } from "@/models/Location";
import { Ticket } from "@/models/Ticket";
import { connectToDB } from "@/lib/mongodb";

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

/**
 * GET /api/locations/hierarchy
 * Returns location hierarchy with ticket counts per location
 */
export async function GET() {
  try {
    await connectToDB();

    // Fetch all active locations
    const locations = await Location.find({ isActive: true }).lean();

    // Fetch all pending tickets
    const pendingTickets = await Ticket.find({ status: "PENDING" }).lean();

    // Build hierarchy first
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

    // Build parent-child relationships
    const roots: LocationNode[] = [];
    
    locationMap.forEach((loc) => {
      if (loc.parentLocationId) {
        const parent = locationMap.get(loc.parentLocationId.toString());
        if (parent) {
          parent.children.push(loc);
        } else {
          roots.push(loc);
        }
      } else {
        roots.push(loc);
      }
    });

    // Build full paths for each location (e.g., "132 → Office → 1-Floor")
    const buildPaths = (node: any, parentPath: string = ""): void => {
      node.fullPath = parentPath ? `${parentPath} → ${node.name}` : node.name;
      node.children.forEach((child: any) => buildPaths(child, node.fullPath));
    };
    roots.forEach((root) => buildPaths(root, ""));

    // Now match tickets to locations based on path matching
    // Tickets have location paths like "132 → Office → 1-Floor"
    pendingTickets.forEach((ticket: any) => {
      const ticketLoc = (ticket.location || "").trim();
      if (!ticketLoc) return;

      // Match ticket to the most specific location (the one whose fullPath matches)
      // Also accumulate counts up the hierarchy
      locationMap.forEach((loc) => {
        // Check if this location's full path matches the ticket's location
        // or if the ticket location starts with this location's path
        if (ticketLoc === loc.fullPath) {
          // Exact match - add to this location
          loc.ticketCount++;
          const priority = (ticket.priority || "").toLowerCase();
          if (priority === "high") loc.highPriority++;
          else if (priority === "medium") loc.mediumPriority++;
          else if (priority === "low") loc.lowPriority++;
        }
      });
    });

    // Sort children by floor order (Terrace at top, G-Floor at bottom, Service floors after regular)
    const floorOrder = (name: string): number => {
      const lower = name.toLowerCase();
      if (lower.includes("terrace")) return 0;
      if (lower.includes("outside")) return 100;
      if (lower.match(/^\d+-floor/)) {
        const num = parseInt(lower.match(/^(\d+)/)?.[1] || "0");
        if (lower.includes("service")) return 50 + num;
        if (lower.includes("sterile")) return 30 + num;
        return 10 + (10 - num); // Higher floors first
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

    // Calculate aggregate ticket counts for buildings (sum of children)
    const aggregateCounts = (node: LocationNode) => {
      node.children.forEach(aggregateCounts);
      if (node.children.length > 0) {
        node.children.forEach(child => {
          node.ticketCount += child.ticketCount;
          node.highPriority += child.highPriority;
          node.mediumPriority += child.mediumPriority;
          node.lowPriority += child.lowPriority;
        });
      }
    };
    roots.forEach(aggregateCounts);

    return NextResponse.json({
      success: true,
      data: roots,
    });
  } catch (err) {
    console.error("[API] Failed to fetch location hierarchy:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
