import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "better-sqlite3",
    "playwright",
    "crawlee",
    "@crawlee/playwright",
    "lighthouse",
    "chrome-launcher",
    "@axe-core/playwright",
  ],
};

export default nextConfig;
