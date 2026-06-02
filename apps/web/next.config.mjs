/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produces a self-contained server bundle for a slim Docker image.
  output: 'standalone',
};

export default nextConfig;
