import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this project so a stray parent lockfile
  // (e.g. ~/package-lock.json) can't misdirect Turbopack's root inference.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
