// lib/auth.ts
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { AdminUser, IAdminUser, SectionKey, APP_SECTIONS } from "@/models/AdminUser";
import bcrypt from "bcryptjs";
import { connectToDB } from "./mongodb";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "super-secret-key-change-in-production"
);
const COOKIE_NAME = "admin_session";
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days in seconds

export interface SessionPayload {
  userId: string;
  username: string;
  isSuperAdmin: boolean;
  permissions: SectionKey[];
  // Location-based access control
  allowedLocationIds: string[]; // Location IDs user can access (empty = all)
  isReadOnly: boolean; // Cannot edit/delete/complete tickets
  hideTimeDetails: boolean; // Time info hidden
  exp: number;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a JWT session token
 */
export async function createSession(user: IAdminUser): Promise<string> {
  // Convert Mongoose arrays to plain JS arrays to avoid serialization issues
  const userPermissions = user.permissions ? [...user.permissions] : [];
  const allowedLocations = user.allowedLocationIds 
    ? user.allowedLocationIds.map(id => id.toString()) 
    : [];
  
  const payload: Omit<SessionPayload, "exp"> = {
    userId: user._id.toString(),
    username: user.username,
    isSuperAdmin: user.isSuperAdmin,
    permissions: user.isSuperAdmin 
      ? Object.keys(APP_SECTIONS) as SectionKey[] 
      : userPermissions as SectionKey[],
    // Location-based access control
    allowedLocationIds: user.isSuperAdmin ? [] : allowedLocations, // Empty for super admin = all access
    isReadOnly: user.isSuperAdmin ? false : (user.isReadOnly || false),
    hideTimeDetails: user.isSuperAdmin ? false : (user.hideTimeDetails || false),
  };

  const token = await new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(JWT_SECRET);

  return token;
}

/**
 * Verify and decode a JWT token
 */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Get the current session from cookies
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  
  if (!token) return null;
  
  return verifySession(token);
}

/**
 * Set session cookie
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

/**
 * Clear session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Check if user has permission for a specific section
 */
export function hasPermission(session: SessionPayload | null, section: SectionKey): boolean {
  if (!session) return false;
  if (session.isSuperAdmin) return true;
  return session.permissions.includes(section);
}

/**
 * Check if user has permission for a specific path
 */
export function hasPermissionForPath(session: SessionPayload | null, path: string): boolean {
  if (!session) return false;
  if (session.isSuperAdmin) return true;
  
  // Find which section this path belongs to
  for (const [key, section] of Object.entries(APP_SECTIONS)) {
    if (path.startsWith(section.path)) {
      return session.permissions.includes(key as SectionKey);
    }
  }
  
  // Default: allow access to unknown paths (like login page, api routes, etc.)
  return true;
}

/**
 * Get allowed navigation links for a user
 */
export function getAllowedNavLinks(session: SessionPayload | null): Array<{name: string, path: string}> {
  if (!session) return [];
  
  const links: Array<{name: string, path: string}> = [];
  
  for (const [key, section] of Object.entries(APP_SECTIONS)) {
    if (session.isSuperAdmin || session.permissions.includes(key as SectionKey)) {
      links.push({ name: section.label, path: section.path });
    }
  }
  
  return links;
}

/**
 * Login function
 */
export async function login(username: string, password: string): Promise<{ success: boolean; error?: string; token?: string }> {
  try {
    await connectToDB();
    
    console.log(`[LOGIN] Attempting login for username: ${username.toLowerCase()}`);
    
    const user = await AdminUser.findOne({ username: username.toLowerCase(), isActive: true });
    
    if (!user) {
      console.log(`[LOGIN] User not found or inactive: ${username.toLowerCase()}`);
      return { success: false, error: "Invalid username or password" };
    }
    
    console.log(`[LOGIN] User found: ${user.username}, checking password...`);
    
    const isValid = await verifyPassword(password, user.passwordHash);
    
    if (!isValid) {
      console.log(`[LOGIN] Invalid password for user: ${username}`);
      return { success: false, error: "Invalid username or password" };
    }
    
    console.log(`[LOGIN] Password valid, creating session...`);
    
    // Update last login
    user.lastLoginAt = new Date();
    await user.save();
    
    const token = await createSession(user);
    
    console.log(`[LOGIN] Login successful for user: ${username}`);
    
    return { success: true, token };
  } catch (error: any) {
    console.error(`[LOGIN] Error during login:`, error);
    return { success: false, error: "Login failed: " + (error.message || "Unknown error") };
  }
}

/**
 * Create initial super admin if none exists
 */
export async function ensureDefaultSuperAdmin(): Promise<void> {
  await connectToDB();
  
  const existingAdmin = await AdminUser.findOne({ isSuperAdmin: true });
  
  if (!existingAdmin) {
    const passwordHash = await hashPassword("admin123");
    await AdminUser.create({
      username: "admin",
      passwordHash,
      displayName: "Super Administrator",
      isSuperAdmin: true,
      permissions: Object.keys(APP_SECTIONS) as SectionKey[],
      isActive: true,
    });
    console.log("✅ Default super admin created (username: admin, password: admin123)");
  }
}
