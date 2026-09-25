import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "EMAUS POS — Iniciar sesión",
  description: "Acceso seguro a EMAUS POS.",
};

const LoginLayout = ({ children }: { children: ReactNode }) => children;

export default LoginLayout;
