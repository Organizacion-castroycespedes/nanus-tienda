import type { ReactNode } from "react";
import Providers from "./providers";
import "../styles/globals.css";

export const metadata = {
  title: "Manus POS — Controla ventas, inventario, caja y pedidos",
  description:
    "",
};

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
};

export default RootLayout;
