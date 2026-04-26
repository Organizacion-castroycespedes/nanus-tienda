import type { ReactNode } from "react";
import Providers from "./providers";
import "../styles/globals.css";

export const metadata = {
  title: "Manus — Gestiona tu negocio desde un solo lugar",
  description:
    "Manus es una plataforma SaaS multi-tenant para pequenos negocios. POS, inventario, clientes, compras y finanzas en un solo lugar.",
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
