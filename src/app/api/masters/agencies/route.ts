import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Agency } from "@/models/AgencyMaster";
import { Category } from "@/models/Category";

/**
 * GET - Fetch all active agencies with their linked categories
 */
export async function GET() {
  try {
    await connectToDB();
    const agencies = await Agency.find({ isActive: true })
      .populate("categories", "_id displayName color")
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({ success: true, data: agencies });
  } catch (error: any) {
    console.error("Error fetching agencies:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Create or update an agency with bidirectional category sync
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDB();
    const body = await req.json();
    const { _id, name, phone, email, notes, categories = [] } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Agency name is required" },
        { status: 400 }
      );
    }

    let agency;
    let oldCategories: string[] = [];

    if (_id) {
      // Get old categories before update
      const existingAgency = await Agency.findById(_id).lean();
      if (existingAgency) {
        oldCategories = (existingAgency.categories || []).map((c: any) => c.toString());
      }

      // Update existing agency
      agency = await Agency.findByIdAndUpdate(
        _id,
        { 
          name: name.trim(), 
          phone, 
          email, 
          notes,
          categories 
        },
        { new: true }
      );
      if (!agency) {
        return NextResponse.json(
          { success: false, error: "Agency not found" },
          { status: 404 }
        );
      }
    } else {
      // Create new agency
      agency = await Agency.create({
        name: name.trim(),
        phone: phone || "",
        email: email || "",
        notes: notes || "",
        categories: categories || [],
      });
    }

    // Sync bidirectional relationship with Category model
    const newCategories = categories.map((c: any) => c.toString());
    
    // Remove agency from old categories that are no longer linked
    const removedCategories = oldCategories.filter(c => !newCategories.includes(c));
    if (removedCategories.length > 0) {
      await Category.updateMany(
        { _id: { $in: removedCategories } },
        { $pull: { agencies: agency._id } }
      );
    }

    // Add agency to new categories
    const addedCategories = newCategories.filter((c: string) => !oldCategories.includes(c));
    if (addedCategories.length > 0) {
      await Category.updateMany(
        { _id: { $in: addedCategories } },
        { $addToSet: { agencies: agency._id } }
      );
    }

    // Populate categories for response
    const populatedAgency = await Agency.findById(agency._id)
      .populate("categories", "_id displayName color")
      .lean();

    return NextResponse.json({ success: true, data: populatedAgency });
  } catch (error: any) {
    console.error("Error saving agency:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Soft delete an agency and remove from all linked categories
 */
export async function DELETE(req: NextRequest) {
  try {
    await connectToDB();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Agency ID is required" },
        { status: 400 }
      );
    }

    // Get the agency to find its linked categories
    const agency = await Agency.findById(id).lean();
    
    const updated = await Agency.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Agency not found" },
        { status: 404 }
      );
    }

    // Remove agency from all linked categories
    if (agency && agency.categories && agency.categories.length > 0) {
      await Category.updateMany(
        { _id: { $in: agency.categories } },
        { $pull: { agencies: id } }
      );
    }

    return NextResponse.json({ success: true, message: "Agency deleted" });
  } catch (error: any) {
    console.error("Error deleting agency:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
