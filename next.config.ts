import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for a minimal, self-contained Cloud Run image.
  output: "standalone",
};

export default nextConfig;
