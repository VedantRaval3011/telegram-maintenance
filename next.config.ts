import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Gzip/br responses from the Node server (HTML, JSON API payloads, etc.).
  compress: true,
  // Drop console.* (except errors/warnings) from the production client bundle.
  compiler: {
    removeConsole: { exclude: ["error", "warn"] },
  },
  experimental: {
    // Transform barrel imports into direct deep imports so only the icons /
    // chart pieces actually used are bundled, shrinking client JS.
    optimizePackageImports: ["lucide-react", "recharts"],
  },
};

export default nextConfig;
