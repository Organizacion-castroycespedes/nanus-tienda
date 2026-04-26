import Link from "next/link";
import { Zap } from "lucide-react";

const Footer = () => (
  <footer className="border-t border-slate-200 bg-white px-6 py-12">
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-8 md:grid-cols-4">
        {/* Brand */}
        <div className="md:col-span-2">
          <Link href="/" className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-900">Manus</span>
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-slate-500">
            Plataforma SaaS multi-tenant para la gestion integral de pequenos
            negocios y emprendedores.
          </p>
        </div>
        {/* Product links */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-900">
            Producto
          </p>
          <ul className="space-y-2">
            {["Funcionalidades", "Como funciona", "Precios", "Actualizaciones"].map(
              (item) => (
                <li key={item}>
                  <Link
                    href="#"
                    className="text-sm text-slate-500 transition hover:text-slate-900"
                  >
                    {item}
                  </Link>
                </li>
              )
            )}
          </ul>
        </div>
        {/* Contact links */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-900">
            Contacto
          </p>
          <ul className="space-y-2">
            {["Soporte", "Contactanos", "Politica de privacidad", "Terminos de uso"].map(
              (item) => (
                <li key={item}>
                  <Link
                    href="#"
                    className="text-sm text-slate-500 transition hover:text-slate-900"
                  >
                    {item}
                  </Link>
                </li>
              )
            )}
          </ul>
        </div>
      </div>
      <div className="mt-10 border-t border-slate-100 pt-6">
        <p className="text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} Manus. Todos los derechos reservados.
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
