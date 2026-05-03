/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1", "localhost", "100.113.78.11"],
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

module.exports = nextConfig;
