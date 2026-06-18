"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "#inicio", label: "Inicio" },
  { href: "#funcionalidades", label: "Funcionalidades" },
  { href: "#beneficios", label: "Beneficios" },
  { href: "#como-funciona", label: "Cómo funciona" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/85 text-white backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1 shadow-lg shadow-blue-950/25">
            <Image
              src="/LogoManus.png.jpeg"
              alt="Manus POS"
              width={40}
              height={40}
              className="h-full w-full object-contain"
              priority
            />
          </span>
          <span className="text-lg font-bold tracking-tight">
            Manus <span className="text-blue-300">POS</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Navegación pública">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-200 transition hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="text-sm font-semibold text-slate-200 transition hover:text-white"
          >
            Iniciar sesión
          </Link>
          <Link
            href="#contacto"
            className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Solicitar demo
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg border border-white/10 p-2 text-slate-100 transition hover:bg-white/10 md:hidden"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <nav
          className="border-t border-white/10 bg-slate-950 px-6 py-4 md:hidden"
          aria-label="Navegación móvil"
        >
          <ul className="space-y-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block rounded-lg px-3 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="grid grid-cols-1 gap-2 pt-2">
              <Link
                href="/login"
                className="rounded-lg border border-white/10 px-3 py-3 text-center text-sm font-semibold text-white"
                onClick={() => setOpen(false)}
              >
                Iniciar sesión
              </Link>
              <Link
                href="#contacto"
                className="rounded-lg bg-white px-3 py-3 text-center text-sm font-bold text-slate-950"
                onClick={() => setOpen(false)}
              >
                Solicitar demo
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
};

export default Navbar;
