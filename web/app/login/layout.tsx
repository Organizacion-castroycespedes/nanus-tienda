import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: `${process.env.NEXT_PUBLIC_LOGIN_BRAND_NAME ?? "EMAUS POS"} — Iniciar sesión`,
  description: `Acceso seguro a ${process.env.NEXT_PUBLIC_LOGIN_BRAND_NAME ?? "EMAUS POS"}.`,
};

const LoginLayout = ({ children }: { children: ReactNode }) => children;

export default LoginLayout;
