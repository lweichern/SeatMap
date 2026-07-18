import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Verification builds set NEXT_DIST_DIR=.next-build so `next build` never
  // clobbers a running dev server's .next. Unset (dev, Vercel) = default.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
