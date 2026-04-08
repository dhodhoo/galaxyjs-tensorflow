import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@tensorflow-models/hand-pose-detection', '@mediapipe/hands'],
};

export default nextConfig;
