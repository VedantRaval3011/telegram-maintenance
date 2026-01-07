"use client";
// contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

interface NavLink {
  name: string;
  path: string;
}

interface User {
  username: string;
  displayName: string;
  isSuperAdmin: boolean;
  permissions: string[];
  // Location-based access control
  allowedLocationIds: string[];
  isReadOnly: boolean;
  hideTimeDetails: boolean;
}

interface AuthContextType {
  user: User | null;
  navLinks: NavLink[];
  isLoading: boolean;
  isAuthenticated: boolean;
  // Access control helpers
  isReadOnly: boolean;
  hideTimeDetails: boolean;
  allowedLocationIds: string[];
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  hasPermission: (section: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Pages that don't require authentication
const PUBLIC_PATHS = ["/login", "/api"];

// Section key to path mapping (for permission checking)
const SECTION_PATHS: Record<string, string[]> = {
  dashboard: ["/dashboard"],
  building_map: ["/dashboard/building-map"],
  categories: ["/masters/categories"],
  users: ["/masters/users"],
  locations: ["/masters/locations"],
  workflows: ["/masters/workflow-rules"],
  informations: ["/masters/informations"],
  agencies: ["/masters/agencies"],
  purchase: ["/purchase"],
  summary: ["/summary"],
  settings: ["/settings"],
  admin: ["/admin"],
};

// Check if a path is allowed for a user
function isPathAllowed(pathname: string, user: User | null): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  
  // Check each section's paths
  for (const [sectionKey, paths] of Object.entries(SECTION_PATHS)) {
    for (const path of paths) {
      if (pathname === path || pathname.startsWith(path + "/")) {
        // This path belongs to this section - check if user has permission
        return user.permissions.includes(sectionKey);
      }
    }
  }
  
  // Unknown path - allow by default (for API routes, etc.)
  return true;
}

// Get the first allowed path for a user
function getFirstAllowedPath(navLinks: NavLink[]): string {
  if (navLinks.length > 0) {
    return navLinks[0].path;
  }
  return "/login"; // Fallback if no permissions
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [navLinks, setNavLinks] = useState<NavLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session");
      const data = await response.json();

      if (data.authenticated) {
        setUser(data.user);
        setNavLinks(data.navLinks);
        return data;
      } else {
        setUser(null);
        setNavLinks([]);
        return null;
      }
    } catch (error) {
      console.error("Auth check error:", error);
      setUser(null);
      setNavLinks([]);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Redirect to login if not authenticated, or to allowed page if no permission
  useEffect(() => {
    if (!isLoading && user) {
      const isPublicPath = PUBLIC_PATHS.some(p => pathname.startsWith(p));
      
      if (!isPublicPath) {
        // Check if user has permission for current path
        if (!isPathAllowed(pathname, user)) {
          // Redirect to first allowed path
          const firstAllowed = getFirstAllowedPath(navLinks);
          console.log(`[AUTH] No permission for ${pathname}, redirecting to ${firstAllowed}`);
          router.push(firstAllowed);
        }
      }
      
      // If authenticated and on login page, redirect to first allowed page
      if (pathname === "/login") {
        const firstAllowed = getFirstAllowedPath(navLinks);
        router.push(firstAllowed);
      }
    } else if (!isLoading && !user) {
      const isPublicPath = PUBLIC_PATHS.some(p => pathname.startsWith(p));
      if (!isPublicPath) {
        router.push("/login");
      }
    }
  }, [user, isLoading, pathname, router, navLinks]);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Check auth and get nav links
        const authData = await checkAuth();
        
        // Redirect to first allowed page
        if (authData?.navLinks?.length > 0) {
          router.push(authData.navLinks[0].path);
        }
        
        return { success: true };
      } else {
        return { success: false, error: data.error || "Login failed" };
      }
    } catch (error) {
      return { success: false, error: "Network error" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      setNavLinks([]);
      router.push("/login");
    }
  };

  const hasPermission = (section: string): boolean => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    return user.permissions.includes(section);
  };

  const value: AuthContextType = {
    user,
    navLinks,
    isLoading,
    isAuthenticated: !!user,
    // Access control helpers - derive from user or default to safe values
    isReadOnly: user?.isReadOnly || false,
    hideTimeDetails: user?.hideTimeDetails || false,
    allowedLocationIds: user?.allowedLocationIds || [],
    login,
    logout,
    checkAuth,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
