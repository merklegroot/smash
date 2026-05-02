import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  enablePrerenderSourceMaps: true,
  experimental: {
    turbopackSourceMaps: true,
    turbopackInputSourceMaps: true,
  },
};

export default nextConfig;
