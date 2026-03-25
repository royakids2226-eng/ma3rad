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
module.exports = {
  allowedDevOrigins: ['3000-firebase-ma3rad-1774449402960.cluster-cbeiita7rbe7iuwhvjs5zww2i4.cloudworkstations.dev'],
}
export default nextConfig;