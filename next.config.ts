import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // We run via a custom server (`server.ts`) so Socket.IO can share the
  // port. See server.ts for why turbopack defaults are unsafe under a
  // custom server.
  //
  // No custom Cache-Control headers — Next 16 already applies immutable
  // caching to hashed assets under /_next/static/* by default. Earlier
  // versions of this file had a redundant override that triggered a
  // "can break Next.js development behavior" warning at build time.
  compress: true,
};

export default nextConfig;
