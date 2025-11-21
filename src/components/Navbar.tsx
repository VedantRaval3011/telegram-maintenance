"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="sticky top-0 z-40 bg-[#ecfdf5]/80 backdrop-blur-md border-b border-emerald-100 mb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold shadow-lg shadow-emerald-200 group-hover:shadow-emerald-300 transition-all">
                M
              </div>
              <div>
                <div className="text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">Maintenance</div>
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Operations</div>
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
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
