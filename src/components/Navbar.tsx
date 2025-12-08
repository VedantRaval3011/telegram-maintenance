"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-gray-50 border-b border-gray-200 mb-8 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-10">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-700 text-white font-bold text-sm shadow-sm group-hover:bg-gray-600 transition-all">
                M
              </div>
              <div>
                <div className="text-base font-semibold text-gray-800 group-hover:text-gray-600 transition-colors">Maintenance</div>
                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Operations</div>
              </div>
            </Link>

            <div className="hidden lg:flex items-center gap-1">
              {[
                { name: "Dashboard", path: "/dashboard" },
                { name: "Categories", path: "/masters/categories" },
                { name: "Users", path: "/masters/users" },
                { name: "Locations", path: "/masters/locations" },
                { name: "Workflows", path: "/masters/workflow-rules" },
                { name: "Informations", path: "/masters/informations" },
                { name: "Agencies", path:"/masters/agencies" },
                { name: "Summary", path: "/summary" },
              ].map((link) => (
                <Link
                  key={link.path}
                  href={link.path}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive(link.path)
                    ? "bg-gray-300 text-gray-800 shadow-sm"
                    : "text-gray-600 hover:bg-gray-200 hover:text-gray-800"
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
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive("/settings")
                ? "bg-gray-300 text-gray-800 shadow-sm"
                : "text-gray-600 hover:bg-gray-200 hover:text-gray-800"
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
