"use client";
import React from "react";
import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="mb-6">
      <div className="bg-white hero-glass p-4 rounded-2xl shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-teal-400 to-indigo-600 text-white font-bold">M</div>
              <div>
                <div className="text-lg font-bold text-gray-900">Maintenance</div>
                <div className="text-xs text-gray-500">Operations • Tickets</div>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-2 ml-6 text-sm text-gray-600">
              <Link href="/dashboard" className="px-3 py-1 rounded hover:bg-gray-50">Dashboard</Link>
              <Link href="/masters/categories" className="px-3 py-1 rounded hover:bg-gray-50">Categories</Link>
              <Link href="/masters/users" className="px-3 py-1 rounded hover:bg-gray-50">Users</Link>
              <Link href="/masters/locations" className="px-3 py-1 rounded hover:bg-gray-50">Locations</Link>
              <Link href="/summary" className="px-3 py-1 rounded hover:bg-gray-50">Summary</Link>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/settings" className="text-sm text-gray-600 px-3 py-1 rounded hover:bg-gray-50">Settings</Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
