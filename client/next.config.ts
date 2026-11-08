import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.FWS_P5_BROWSER_TEST === 'true' ? '.next-p5-browser' : '.next',
  env: {
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_BASE_API_URL ||
      "",
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 't4.ftcdn.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.ftcdn.net',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
