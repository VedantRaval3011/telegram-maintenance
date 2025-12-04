"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-[#E8DDD0] border-b border-[#D4C4B0] mb-8 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-10">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-600 text-white font-bold text-sm shadow-sm group-hover:shadow-md transition-all">
                M
              </div>
              <div>
                <div className="text-base font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">Maintenance</div>
                <div className="text-[10px] font-medium text-gray-600 uppercase tracking-wide">Operations</div>
              </div>
            </Link>

            <div className="hidden lg:flex items-center gap-1">
              {[
                { name: "Dashboard", path: "/dashboard" },
                { name: "Categories", path: "/masters/categories" },
                { name: "Users", path: "/masters/users" },
                { name: "Locations", path: "/masters/locations" },
                { name: "Workflows", path: "/masters/workflow-rules" },
                { name: "Summary", path: "/summary" },
              ].map((link) => (
                <Link
                  key={link.path}
                  href={link.path}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive(link.path)
                      ? "bg-[#8B7355] text-white shadow-sm"
                      : "text-gray-700 hover:bg-[#D4C4B0] hover:text-gray-900"
                  }`}
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link 
              href="/settings" 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive("/settings")
                  ? "bg-[#8B7355] text-white shadow-sm"
                  : "text-gray-700 hover:bg-[#D4C4B0] hover:text-gray-900"
              }`}
            >
              Settings
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
