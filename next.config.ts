import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server build for Docker / VPS hosting (.next/standalone).
  output: "standalone",
  poweredByHeader: false,
  // Room for a 1 MB shop logo upload.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};

export default nextConfig;
