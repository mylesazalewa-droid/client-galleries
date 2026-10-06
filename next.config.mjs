/** @type {import('next').NextConfig} */
export default {
  serverExternalPackages: ["archiver", "googleapis"],
  poweredByHeader: false,
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      // Share links carry a key in the URL; only send the bare origin to other sites.
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];
    return [
      // Everything except the embeddable player can't be put inside another site's frame.
      { source: "/:path((?!embed/).*)", headers: [...base, { key: "X-Frame-Options", value: "DENY" }, { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }] },
      { source: "/embed/:path*", headers: base },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "private, no-store" }] },
      { source: "/admin", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};
