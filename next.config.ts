import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone build for Docker / Cloud Run — produces .next/standalone with
  // only the runtime files (~70% smaller image, no node_modules at deploy time).
  output: "standalone",
};

export default nextConfig;
