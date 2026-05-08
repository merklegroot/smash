import type { NextConfig } from "next";

const isStaticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isStaticExport ? { output: "export" as const } : {}),
  productionBrowserSourceMaps: false,
  enablePrerenderSourceMaps: true,
  experimental: {
    turbopackSourceMaps: true,
    turbopackInputSourceMaps: true,
  },
};

export default nextConfig;
