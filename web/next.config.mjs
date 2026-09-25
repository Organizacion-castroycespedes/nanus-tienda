/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    LOGIN_BG_IMAGE:
      process.env.LOGIN_BG_IMAGE ??
      (process.env.NODE_ENV === "production"
        ? "/logo-login-tablet.png"
        : "/login-bg.jpg"),
    LOGIN_BRAND_NAME:
      process.env.LOGIN_BRAND_NAME ??
      (process.env.NODE_ENV === "production" ? "EMAUS POS" : "MANUS POS"),
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
