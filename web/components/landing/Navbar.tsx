"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/LogoManus.png-AQn35KrUXzECzcI6dhjsq3tPKsUTFa.jpeg"
            alt="Manus POS"
            className="h-10 w-auto object-contain"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex" aria-label="Navegacion principal">
          <Link
            href="#funcionalidades"
            className="text-sm text-slate-600 transition hover:text-slate-900"
          >
            Funcionalidades
          </Link>
          <Link
            href="#beneficios"
            className="text-sm text-slate-600 transition hover:text-slate-900"
          >
            Beneficios
          </Link>
          <Link
            href="#como-funciona"
            className="text-sm text-slate-600 transition hover:text-slate-900"
          >
            Como funciona
          </Link>
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="text-sm font-medium text-slate-700 transition hover:text-slate-900"
          >
            Iniciar sesion
          </Link>
          <Link
            href="#contacto"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Solicitar demo
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="rounded-md p-2 text-slate-600 transition hover:bg-slate-100 md:hidden"
          aria-label={open ? "Cerrar menu" : "Abrir menu"}
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open ? (
        <nav
          className="border-t border-slate-100 bg-white px-6 pb-4 pt-2 md:hidden"
          aria-label="Navegacion movil"
        >
          <ul className="space-y-1">
            {[
              { href: "#funcionalidades", label: "Funcionalidades" },
              { href: "#beneficios", label: "Beneficios" },
              { href: "#como-funciona", label: "Como funciona" },
            ].map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="block rounded-md px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                  onClick={() => setOpen(false)}
                >
                  {label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <Link
                href="#contacto"
                className="block rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white"
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
