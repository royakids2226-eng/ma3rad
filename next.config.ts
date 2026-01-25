/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "redesigned-couscous-4j5g9vvw6r9p2jg66-3000.app.github.dev", // الرابط الخاص بك
      ],
    },
  },
};

export default nextConfig;