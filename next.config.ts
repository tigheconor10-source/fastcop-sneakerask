import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Permite mostrar las fotos guardadas en el "storage" de Supabase
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
      },
    ],
  },
};

export default nextConfig;
