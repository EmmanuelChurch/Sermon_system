/** @type {import('next').NextConfig} */
const nextConfig = {
  // Make the recordings directory accessible from the web
  async rewrites() {
    return [
      {
        source: '/recordings/:path*',
        destination: '/api/file/:path*',
      },
    ];
  },
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
};

export default nextConfig; 