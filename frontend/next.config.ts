import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Next 16 blocks cross-origin requests to /_next/webpack-hmr by
  // default. The dev stack starts on 0.0.0.0 but the browser usually
  // hits 127.0.0.1 / localhost — Next treats those as cross-origin,
  // blocks the HMR WebSocket, and *client-side hydration silently
  // fails*. That breaks every React event handler and useEffect on
  // the page. Allow the obvious local hosts.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
