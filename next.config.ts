import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/copydesign",
  output: "standalone",
  env: {
    NEXT_PUBLIC_BASE_PATH: "/copydesign",
  },
};

export default nextConfig;
