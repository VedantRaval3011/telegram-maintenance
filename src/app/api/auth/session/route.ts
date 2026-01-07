// app/api/auth/session/route.ts
import { NextResponse } from "next/server";
import { getSession, getAllowedNavLinks } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({
        authenticated: false,
      });
    }

    const navLinks = getAllowedNavLinks(session);

    return NextResponse.json({
      authenticated: true,
      user: {
        username: session.username,
        displayName: session.displayName,
        isSuperAdmin: session.isSuperAdmin,
        permissions: session.permissions,
        // Access control fields
        allowedLocationIds: session.allowedLocationIds || [],
        isReadOnly: session.isReadOnly || false,
        hideTimeDetails: session.hideTimeDetails || false,
      },
      navLinks,
    });
  } catch (error: any) {
    console.error("Session check error:", error);
    return NextResponse.json(
      { error: "Session check failed" },
      { status: 500 }
    );
  }
}
