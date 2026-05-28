import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // We run via a custom server (`server.ts`) so Socket.IO can share the
  // port. See server.ts for why turbopack defaults are unsafe under a
  // custom server.
  //
  // No custom Cache-Control headers — Next 16 already applies immutable
  // caching to hashed assets under /_next/static/* by default.
  compress: true,
  // React Compiler — auto-memoizes components + hooks so we don't need
  // manual useMemo / useCallback sprinkled everywhere to keep large
  // lists responsive. Opt-in in Next 16; the Compiler is stable as of
  // React 19.
  reactCompiler: true,
  // Surface caching headers on the service worker file so the browser
  // updates it within ~24h of a deploy rather than the default
  // immutable behavior.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
