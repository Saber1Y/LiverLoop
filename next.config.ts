import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "dkg.js", "mediainfo.js", "ffmpeg-static"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "agent.livepeer.org" }],
  },
};

export default nextConfig;
