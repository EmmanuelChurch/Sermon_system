import { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Ensure Node.js modules don't break browser bundles
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't attempt to import these Node.js modules in the browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        child_process: false,
        util: false,
        crypto: false,
        http: false,
        https: false,
        stream: false,
        zlib: false,
      };
    }
    return config;
  },
  
  // Output as standalone to optimize for Vercel
  output: 'standalone',
  
  // Disable image optimization during development for faster builds
  images: {
    unoptimized: process.env.NODE_ENV === 'development',
  },
  
  // Use React strict mode
  reactStrictMode: true,
  
  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      allowedOrigins: ['localhost:3000']
    },
  }
};

export default nextConfig;
