/** @type {import('next').NextConfig} */
import { resolveLoginBranding } from "./lib/login-branding.mjs";

const loginBranding = resolveLoginBranding(process.env);

const nextConfig = {
  env: {
    LOGIN_BG_IMAGE: loginBranding.backgroundImage,
    LOGIN_BRAND_NAME: loginBranding.brandName,
  },
  async rewrites() {
    const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://localhost:4020";

    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
