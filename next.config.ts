import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https", // Discord serves images over HTTPS
        hostname: "cdn.discordapp.com",
        port: "", // Leaving port empty means any port on the hostname is allowed
        pathname: "/avatars/**", // This allows images within the '/avatars/' path or any subdirectories
      },
    ],
  },
  /* config options here */
  /* i18n: {
    locales: ['en-gb'],
    defaultLocale: 'en-gb',
  }*/
};

export default nextConfig;
