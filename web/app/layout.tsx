import type { ReactNode } from "react";
import Providers from "./providers";
import "../styles/globals.css";

export const metadata = {
  title: "Manus POS — Controla ventas, inventario, caja y pedidos",
  description:
    "Manus POS es el software para tiendas, minimarkets y pequeños negocios. Punto de venta, inventario, caja, pedidos, compras, clientes y reportes en un solo lugar.",
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
