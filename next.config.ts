import type { NextConfig } from "next"
import path from "path"

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
}

export default nextConfig
