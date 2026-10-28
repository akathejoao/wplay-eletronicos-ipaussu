import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingIncludes: {
    "/api/download/apk": ["./public/downloads/wplay-app.apk"],
  },
};

export default nextConfig;
