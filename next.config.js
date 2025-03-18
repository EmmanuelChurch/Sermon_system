/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Replace Node.js modules with empty modules in browser context
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        child_process: false,
        util: false,
      };
    }
    return config;
  },
  // Ensure serverless deployment on Vercel
  output: 'standalone',
};

module.exports = nextConfig; 