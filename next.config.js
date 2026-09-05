/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/api/wallpaper': ['./assets/fonts/**'],
    },
  },
};

module.exports = nextConfig;
