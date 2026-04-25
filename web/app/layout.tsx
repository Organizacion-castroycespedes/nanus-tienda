import type { ReactNode } from "react";
import Providers from "./providers";
import "../styles/globals.css";

export const metadata = {
  title: "Soft Tenantcore Platform",
  description: "MVP multi-tenant",
};

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
};

export default RootLayout;
