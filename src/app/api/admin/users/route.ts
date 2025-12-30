// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import { AdminUser, APP_SECTIONS, SectionKey } from "@/models/AdminUser";
import { getSession, hashPassword, hasPermission } from "@/lib/auth";

// GET - List all admin users
export async function GET() {
  try {
    const session = await getSession();
    
    if (!session || !hasPermission(session, "admin")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDB();

    const users = await AdminUser.find({})
      .select("-passwordHash") // Never return password hash
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      users,
      sections: APP_SECTIONS,
    });
  } catch (error: any) {
    console.error("Error fetching admin users:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin users" },
      { status: 500 }
    );
  }
}

// POST - Create new admin user
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session || !hasPermission(session, "admin")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only super admins can create users
    if (!session.isSuperAdmin) {
      return NextResponse.json(
        { error: "Only super admins can create users" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { 
      username, password, displayName, email, isSuperAdmin, permissions,
      // New access control fields
      allowedLocationIds, isReadOnly, hideTimeDetails
    } = body;

    // Validation
    if (!username || !password || !displayName) {
      return NextResponse.json(
        { error: "Username, password, and display name are required" },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    await connectToDB();

    // Check for existing username
    const existingUser = await AdminUser.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Validate permissions
    const validPermissions = Object.keys(APP_SECTIONS) as SectionKey[];
    const filteredPermissions = (permissions || []).filter(
      (p: string) => validPermissions.includes(p as SectionKey)
    );

    // Create user
    const newUser = await AdminUser.create({
      username: username.toLowerCase().trim(),
      passwordHash,
      displayName: displayName.trim(),
      email: email?.toLowerCase().trim() || null,
      isSuperAdmin: isSuperAdmin || false,
      permissions: isSuperAdmin ? validPermissions : filteredPermissions,
      // Location-based access control
      allowedLocationIds: allowedLocationIds || [],
      isReadOnly: isReadOnly || false,
      hideTimeDetails: hideTimeDetails || false,
      isActive: true,
      createdBy: session.userId,
    });

    // Return user without password hash
    const userResponse = {
      _id: newUser._id,
      username: newUser.username,
      displayName: newUser.displayName,
      email: newUser.email,
      isSuperAdmin: newUser.isSuperAdmin,
      permissions: newUser.permissions,
      allowedLocationIds: newUser.allowedLocationIds,
      isReadOnly: newUser.isReadOnly,
      hideTimeDetails: newUser.hideTimeDetails,
      isActive: newUser.isActive,
      createdAt: newUser.createdAt,
    };

    return NextResponse.json({
      success: true,
      user: userResponse,
    });
  } catch (error: any) {
    console.error("Error creating admin user:", error);
    return NextResponse.json(
      { error: "Failed to create admin user" },
      { status: 500 }
    );
  }
}
