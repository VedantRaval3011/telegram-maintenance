"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

  const navLinks = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Building Map", path: "/dashboard/building-map" },
    { name: "Categories", path: "/masters/categories" },
    { name: "Users", path: "/masters/users" },
    { name: "Locations", path: "/masters/locations" },
    { name: "Workflows", path: "/masters/workflow-rules" },
    { name: "Informations", path: "/masters/informations" },
    { name: "Agencies", path: "/masters/agencies" },
    { name: "Summary", path: "/summary" },
    { name: "Settings", path: "/settings" },
  ];

  return (
    <>
      <nav className="sticky top-0 z-50 bg-gray-50 border-b border-gray-200 mb-4 md:mb-8 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            <div className="flex items-center gap-4 md:gap-10">
              {/* Logo */}
              <Link href="/dashboard" className="flex items-center gap-2 md:gap-3 group">
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center bg-gray-700 text-white font-bold text-sm shadow-sm group-hover:bg-gray-600 transition-all">
                  M
                </div>
                <div>
                  <div className="text-sm md:text-base font-semibold text-gray-800 group-hover:text-gray-600 transition-colors">Maintenance</div>
                  <div className="text-[9px] md:text-[10px] font-medium text-gray-500 uppercase tracking-wide">Operations</div>
                </div>
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden lg:flex items-center gap-1">
                {navLinks.slice(0, -1).map((link) => (
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

            <div className="flex items-center gap-2 md:gap-3">
              {/* Desktop Settings Link */}
              <Link
                href="/settings"
                className={`hidden lg:block px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive("/settings")
                  ? "bg-gray-300 text-gray-800 shadow-sm"
                  : "text-gray-600 hover:bg-gray-200 hover:text-gray-800"
                  }`}
              >
                Settings
              </Link>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition-all"
                aria-label="Toggle mobile menu"
              >
                {isMobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div 
        className={`fixed top-0 right-0 z-50 h-full w-72 bg-gray-50 shadow-xl transform transition-transform duration-300 ease-in-out lg:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <span className="text-lg font-semibold text-gray-800">Menu</span>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-64px)]">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive(link.path)
                ? "bg-gray-300 text-gray-800 shadow-sm"
                : "text-gray-600 hover:bg-gray-200 hover:text-gray-800"
                }`}
            >
              {link.name}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
