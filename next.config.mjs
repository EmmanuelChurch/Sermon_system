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
};

export default nextConfig; 