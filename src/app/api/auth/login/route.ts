// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { login, setSessionCookie, ensureDefaultSuperAdmin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Ensure default super admin exists
    await ensureDefaultSuperAdmin();

    const result = await login(username, password);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }

    // Set session cookie
    await setSessionCookie(result.token!);

    return NextResponse.json({
      success: true,
      message: "Login successful",
    });
  } catch (error: any) {
    console.error("Login error:", error);
    
    // Check if it's a database connection error
    if (error.message?.includes('Unable to connect to MongoDB') || 
        error.code === 'ETIMEOUT' || 
        error.syscall === 'querySrv') {
      return NextResponse.json(
        { error: "Database connection failed. Please check your internet connection." },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
