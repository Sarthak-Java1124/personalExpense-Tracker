import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libSQL ships native bindings for local SQLite files; keep it out of the bundle.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
