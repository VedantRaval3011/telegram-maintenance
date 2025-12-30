// app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { AdminUser, APP_SECTIONS, SectionKey } from "@/models/AdminUser";
import { getSession, hashPassword, hasPermission } from "@/lib/auth";

// GET - Get single admin user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session || !hasPermission(session, "admin")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    await connectToDB();

    const user = await AdminUser.findById(id)
      .select("-passwordHash")
      .lean();

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error("Error fetching admin user:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin user" },
      { status: 500 }
    );
  }
}

// PUT - Update admin user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session || !hasPermission(session, "admin")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!session.isSuperAdmin) {
      return NextResponse.json(
        { error: "Only super admins can update users" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { 
      displayName, email, password, isSuperAdmin, permissions, isActive,
      // New access control fields
      allowedLocationIds, isReadOnly, hideTimeDetails
    } = body;

    await connectToDB();

    const user = await AdminUser.findById(id);

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Update fields
    if (displayName !== undefined) {
      user.displayName = displayName.trim();
    }

    if (email !== undefined) {
      user.email = email?.toLowerCase().trim() || null;
    }

    if (password && password.length >= 6) {
      user.passwordHash = await hashPassword(password);
    }

    if (isSuperAdmin !== undefined) {
      user.isSuperAdmin = isSuperAdmin;
    }

    if (permissions !== undefined) {
      const validPermissions = Object.keys(APP_SECTIONS) as SectionKey[];
      user.permissions = permissions.filter(
        (p: string) => validPermissions.includes(p as SectionKey)
      );
    }

    if (isActive !== undefined) {
      user.isActive = isActive;
    }

    // Update access control fields
    if (allowedLocationIds !== undefined) {
      user.allowedLocationIds = allowedLocationIds;
    }

    if (isReadOnly !== undefined) {
      user.isReadOnly = isReadOnly;
    }

    if (hideTimeDetails !== undefined) {
      user.hideTimeDetails = hideTimeDetails;
    }

    // If super admin, give all permissions and clear restrictions
    if (user.isSuperAdmin) {
      user.permissions = Object.keys(APP_SECTIONS) as SectionKey[];
      user.allowedLocationIds = []; // Super admin can access all locations
      user.isReadOnly = false;
      user.hideTimeDetails = false;
    }

    await user.save();

    // Return user without password hash
    const userResponse = {
      _id: user._id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      permissions: user.permissions,
      allowedLocationIds: user.allowedLocationIds,
      isReadOnly: user.isReadOnly,
      hideTimeDetails: user.hideTimeDetails,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return NextResponse.json({
      success: true,
      user: userResponse,
    });
  } catch (error: any) {
    console.error("Error updating admin user:", error);
    return NextResponse.json(
      { error: "Failed to update admin user" },
      { status: 500 }
    );
  }
}

// DELETE - Delete admin user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session || !hasPermission(session, "admin")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!session.isSuperAdmin) {
      return NextResponse.json(
        { error: "Only super admins can delete users" },
        { status: 403 }
      );
    }

    const { id } = await params;
    await connectToDB();

    // Prevent deleting yourself
    if (id === session.userId) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    const user = await AdminUser.findById(id);

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if this is the last super admin
    if (user.isSuperAdmin) {
      const superAdminCount = await AdminUser.countDocuments({ isSuperAdmin: true });
      if (superAdminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot delete the last super admin" },
          { status: 400 }
        );
      }
    }

    await AdminUser.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting admin user:", error);
    return NextResponse.json(
      { error: "Failed to delete admin user" },
      { status: 500 }
    );
  }
}
