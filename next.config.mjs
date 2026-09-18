/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: "aeyiwayubsfjbrwfreqn.supabase.co",
        pathname: "/storage/v1/object/public/nexus-screen-previews/**",
        protocol: "https",
      },
    ],
  },
};

export default nextConfig;
