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
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
