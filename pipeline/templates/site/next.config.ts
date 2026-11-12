import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The self-test and the production build use their own folders, so the live preview (.next) keeps working.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // No Next.js dev badge: it covers the website in Gagesite's preview.
  devIndicators: false,
  images: {
    // Sample photos chosen in the plan come from these hosts until the owner's own photos replace them.
    remotePatterns: [
      { protocol: "https", hostname: "**.staticflickr.com" },
      { protocol: "https", hostname: "images.rawpixel.com" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
