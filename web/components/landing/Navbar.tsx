"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Zap } from "lucide-react";

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-slate-900">Manus</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex" aria-label="Navegacion principal">
          <Link
            href="#features"
            className="text-sm text-slate-600 transition hover:text-slate-900"
          >
            Funcionalidades
          </Link>
          <Link
            href="#benefits"
            className="text-sm text-slate-600 transition hover:text-slate-900"
          >
            Beneficios
          </Link>
          <Link
            href="#how"
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
            href="/login"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Empezar gratis
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
              { href: "#features", label: "Funcionalidades" },
              { href: "#benefits", label: "Beneficios" },
              { href: "#how", label: "Como funciona" },
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
                href="/login"
                className="block rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white"
                onClick={() => setOpen(false)}
              >
                Empezar gratis
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
};

export default Navbar;
