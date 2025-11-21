"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="sticky top-0 z-40 bg-gradient-to-r from-[#d4c0ae] via-[#e8d5c4] to-[#d4c0ae] backdrop-blur-md border-b border-[#b8a293] mb-6 shadow-lg shadow-[#b8a293]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#7d6856] to-[#5c4a3d] text-[#f5ebe0] font-bold shadow-lg shadow-[#7d6856]/50 group-hover:shadow-[#5c4a3d]/50 transition-all">
                M
              </div>
              <div>
                <div className="text-lg font-bold text-[#2c2420] group-hover:text-[#3d332c] transition-colors">Maintenance</div>
                <div className="text-[11px] font-medium text-[#5c4a3d] uppercase tracking-wider">Operations</div>
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
                      ? "bg-[#7d6856] text-[#f5ebe0] border border-[#5c4a3d]"
                      : "text-[#3d332c] hover:bg-[#e8d5c4] hover:text-[#2c2420]"
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
                  ? "bg-[#7d6856] text-[#f5ebe0] border border-[#5c4a3d]"
                  : "text-[#3d332c] hover:bg-[#e8d5c4] hover:text-[#2c2420]"
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
