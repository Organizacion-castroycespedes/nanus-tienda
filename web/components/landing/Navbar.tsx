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

type NavbarProps = {
  onRequestDemo: () => void;
};

const Navbar = ({ onRequestDemo }: NavbarProps) => {
  const [open, setOpen] = useState(false);
  const handleRequestDemo = () => {
    setOpen(false);
    onRequestDemo();
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[rgba(8,18,32,0.92)] text-white shadow-[0_18px_45px_rgba(2,6,23,0.28)] backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center" onClick={() => setOpen(false)}>
          <Image
            src="/LogoManus.png.jpeg"
            alt="Manus POS"
            width={178}
            height={64}
            className="h-14 w-auto max-w-[176px] object-contain sm:h-16 sm:max-w-[196px]"
            priority
          />
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
          <button
            type="button"
            className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={handleRequestDemo}
          >
            Solicitar demo
          </button>
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
              <button
                type="button"
                className="rounded-lg bg-white px-3 py-3 text-center text-sm font-bold text-slate-950"
                onClick={handleRequestDemo}
              >
                Solicitar demo
              </button>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
};

export default Navbar;
