import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: `${process.env.LOGIN_BRAND_NAME ?? "EMAUS POS"} — Iniciar sesión`,
  description: `Acceso seguro a ${process.env.LOGIN_BRAND_NAME ?? "EMAUS POS"}.`,
};

const LoginLayout = ({ children }: { children: ReactNode }) => children;

export default LoginLayout;
