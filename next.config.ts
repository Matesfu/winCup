import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure server-only modules never reach the client bundle
  serverExternalPackages: [],

  // Strict mode for React 19
  reactStrictMode: true,

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
