import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: [
    "@ishaqyusuf/logly-next",
    "@logly/auth",
    "@logly/collector",
    "@logly/db",
    "@logly/ui",
    "@logly/utils",
  ],
  typedRoutes: true,
};

export default nextConfig;
