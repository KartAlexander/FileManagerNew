/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_BACKEND_URL: 'http://localhost:8000',
  },
  reactStrictMode: true,
};

module.exports = nextConfig;
