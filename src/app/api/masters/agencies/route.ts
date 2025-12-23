import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { Agency } from "@/models/AgencyMaster";
import { Category } from "@/models/Category";
import { SubCategory } from "@/models/SubCategoryMaster";

/**
 * GET - Fetch all active agencies with their linked categories and subcategories
 */
export async function GET() {
  try {
    await connectToDB();
    const agencies = await Agency.find({ isActive: true })
      .populate("categories", "_id displayName color")  // Legacy: populate categories
      .populate({
        path: "subCategories",
        select: "_id name categoryId icon",
        populate: {
          path: "categoryId",
          select: "_id displayName color"
        }
      })
      .sort({ name: 1 })
      .lean();

    // Filter out null/deleted category references from each agency
    const cleanedAgencies = agencies.map((agency: any) => ({
      ...agency,
      categories: (agency.categories || []).filter((cat: any) => cat !== null && cat !== undefined),
      subCategories: (agency.subCategories || []).filter((sub: any) => sub !== null && sub !== undefined),
    }));

    return NextResponse.json({ success: true, data: cleanedAgencies });
  } catch (error: any) {
    console.error("Error fetching agencies:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Create or update an agency with bidirectional category/subcategory sync
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDB();
    const body = await req.json();
    const { _id, name, phone, email, notes, categories = [], subCategories = [] } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Agency name is required" },
        { status: 400 }
      );
    }

    let agency;
    let oldCategories: string[] = [];
    let oldSubCategories: string[] = [];

    if (_id) {
      // Get old categories/subcategories before update
      const existingAgency = await Agency.findById(_id).lean();
      if (existingAgency) {
        oldCategories = (existingAgency.categories || []).map((c: any) => c.toString());
        oldSubCategories = (existingAgency.subCategories || []).map((c: any) => c.toString());
      }

      // Update existing agency
      agency = await Agency.findByIdAndUpdate(
        _id,
        { 
          name: name.trim(), 
          phone, 
          email, 
          notes,
          categories,
          subCategories 
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
        subCategories: subCategories || [],
      });
    }

    // Sync bidirectional relationship with Category model (legacy)
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

    // Sync bidirectional relationship with SubCategory model
    const newSubCategories = subCategories.map((c: any) => c.toString());
    
    // Remove agency from old subcategories that are no longer linked
    const removedSubCategories = oldSubCategories.filter(c => !newSubCategories.includes(c));
    if (removedSubCategories.length > 0) {
      await SubCategory.updateMany(
        { _id: { $in: removedSubCategories } },
        { $pull: { agencies: agency._id } }
      );
    }

    // Add agency to new subcategories
    const addedSubCategories = newSubCategories.filter((c: string) => !oldSubCategories.includes(c));
    if (addedSubCategories.length > 0) {
      await SubCategory.updateMany(
        { _id: { $in: addedSubCategories } },
        { $addToSet: { agencies: agency._id } }
      );
    }

    // Populate for response
    const populatedAgency = await Agency.findById(agency._id)
      .populate("categories", "_id displayName color")
      .populate({
        path: "subCategories",
        select: "_id name categoryId icon",
        populate: {
          path: "categoryId",
          select: "_id displayName color"
        }
      })
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
 * DELETE - Soft delete an agency and remove from all linked categories/subcategories
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

    // Get the agency to find its linked categories/subcategories
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

    // Remove agency from all linked subcategories
    if (agency && agency.subCategories && agency.subCategories.length > 0) {
      await SubCategory.updateMany(
        { _id: { $in: agency.subCategories } },
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
