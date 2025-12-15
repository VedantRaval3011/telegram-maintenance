"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Menu,
  X,
  LayoutDashboard,
  Database,
  Settings,
  BarChart3,
  Map,
  Users,
  Layers,
  Info,
  Building2,
  Upload,
  Workflow
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => pathname === path;
  const isParentActive = (paths: string[]) => paths.some(path => pathname.startsWith(path));

  const dashboardLinks = [
    { name: "Overview", path: "/dashboard", icon: LayoutDashboard },
    { name: "Building Map", path: "/dashboard/building-map", icon: Map },
    { name: "Summary", path: "/summary", icon: BarChart3 },
  ];

  const mastersLinks = [
    { name: "Categories", path: "/masters/categories", icon: Layers },
    { name: "Users", path: "/masters/users", icon: Users },
    { name: "Locations", path: "/masters/locations", icon: Building2 },
    { name: "Workflows", path: "/masters/workflow-rules", icon: Workflow },
    { name: "Informations", path: "/masters/informations", icon: Info },
    { name: "Agencies", path: "/masters/agencies", icon: Users },
    { name: "Media Upload", path: "/masters/media-upload", icon: Upload },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on path change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setOpenDropdown(null);
  }, [pathname]);

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 mb-8 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-600 text-white font-bold text-lg shadow-lg shadow-indigo-200 group-hover:bg-indigo-700 transition-all duration-300">
                M
              </div>
              <div className="hidden sm:block">
                <div className="text-lg font-bold text-gray-900 leading-tight">Maintenance</div>
                <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Operations Hub</div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-2" ref={dropdownRef}>
              {/* Dashboard Dropdown */}
              <div className="relative">
                <button
                  onClick={() => toggleDropdown("dashboard")}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${isParentActive(["/dashboard", "/summary"])
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                >
                  Dashboard <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${openDropdown === "dashboard" ? "rotate-180" : ""}`} />
                </button>
                {openDropdown === "dashboard" && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2">
                      {dashboardLinks.map((link) => (
                        <Link
                          key={link.path}
                          href={link.path}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive(link.path)
                              ? "bg-indigo-50 text-indigo-700"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            }`}
                        >
                          <link.icon className={`w-4 h-4 ${isActive(link.path) ? "text-indigo-600" : "text-gray-400"}`} />
                          {link.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Masters Dropdown */}
              <div className="relative">
                <button
                  onClick={() => toggleDropdown("masters")}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${isParentActive(["/masters"])
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                >
                  Masters <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${openDropdown === "masters" ? "rotate-180" : ""}`} />
                </button>
                {openDropdown === "masters" && (
                  <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 grid grid-cols-1">
                      {mastersLinks.map((link) => (
                        <Link
                          key={link.path}
                          href={link.path}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive(link.path)
                              ? "bg-indigo-50 text-indigo-700"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            }`}
                        >
                          <link.icon className={`w-4 h-4 ${isActive(link.path) ? "text-indigo-600" : "text-gray-400"}`} />
                          {link.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/settings"
              className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${isActive("/settings")
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 animate-in slide-in-from-top duration-300">
          <div className="px-4 pt-2 pb-6 space-y-4">
            <div>
              <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Dashboard</div>
              <div className="grid grid-cols-1 gap-1">
                {dashboardLinks.map((link) => (
                  <Link
                    key={link.path}
                    href={link.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive(link.path)
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-gray-600"
                      }`}
                  >
                    <link.icon className={`w-5 h-5 ${isActive(link.path) ? "text-indigo-600" : "text-gray-400"}`} />
                    {link.name}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Master Data</div>
              <div className="grid grid-cols-1 gap-1">
                {mastersLinks.map((link) => (
                  <Link
                    key={link.path}
                    href={link.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive(link.path)
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-gray-600"
                      }`}
                  >
                    <link.icon className={`w-5 h-5 ${isActive(link.path) ? "text-indigo-600" : "text-gray-400"}`} />
                    {link.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <Link
                href="/settings"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive("/settings")
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600"
                  }`}
              >
                <Settings className={`w-5 h-5 ${isActive("/settings") ? "text-indigo-600" : "text-gray-400"}`} />
                Settings
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
