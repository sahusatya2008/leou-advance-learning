import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle: this is what a cheap container host runs, and
  // it keeps the runtime image small enough for a free tier.
  output: "standalone",

  // Do not advertise the framework.
  poweredByHeader: false,

  compress: true,

  // The face pipeline needs a longer budget than the default, and nothing in
  // this app should ever be cached by a shared proxy without a revalidate rule.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // Static files under `public/` normally ship with `Cache-Control: max-age=0`,
      // which means every repeat visit re-downloads them *from this Mac*. These
      // two directories are ~31MB of face models and the Monaco editor: the single
      // biggest avoidable drain on the host's uplink. They are effectively
      // immutable — the model files never change, and Monaco's bundles are
      // content-hashed — so cache them hard at the edge and in the browser.
      // If Monaco is ever upgraded, bump this path (e.g. `/vendor/monaco/v2`) so
      // clients do not hold a stale editor for a year.
      {
        source: "/models/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/vendor/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/payment-qr.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },

  experimental: {
    // Streaming server actions can hold a request open; keep the ceiling finite
    // so a stuck upload cannot pin a connection forever.
    proxyTimeout: 30_000,
  },
};

export default nextConfig;
