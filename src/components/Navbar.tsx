"use client";
import React from "react";
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
                { name: "Building Map", path: "/dashboard/building-map" },
                { name: "Categories", path: "/masters/categories" },
                { name: "Users", path: "/masters/users" },
                { name: "Locations", path: "/masters/locations" },
                { name: "Workflows", path: "/masters/workflow-rules" },
                { name: "Informations", path: "/masters/informations" },
                { name: "Agencies", path: "/masters/agencies" },
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
    </nav>
  );
}
