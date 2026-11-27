import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a second build (e.g. tests) run alongside `next dev` without sharing .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // PGlite loads its own WASM/data files at runtime; don't bundle it.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Keep the dev badge clear of the sidebar footer (theme toggle).
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
