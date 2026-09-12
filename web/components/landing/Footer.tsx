import Link from "next/link";
import Image from "next/image";

const Footer = () => (
  <footer className="border-t border-slate-200 bg-white px-6 py-12 dark:bg-slate-800 dark:border-slate-700">
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-8 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <div>
          <Link href="/" className="inline-flex items-center">
            <span className="flex h-20 shrink-0 items-center justify-center overflow-hidden bg-white">
              <Image
                src="/LogoManus.png.jpeg"
                alt="Manus POS"
                width={236}
                height={84}
                className="h-16 w-auto object-contain"
              />
            </span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300">
            Software web para operar ventas, inventario, caja, pedidos y
            reportes en tiendas, minimarkets y negocios pequeños.
          </p>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-950">
            Producto
          </p>
          <ul className="space-y-2">
            {[
              { href: "#funcionalidades", label: "Funcionalidades" },
              { href: "#beneficios", label: "Beneficios" },
              { href: "#como-funciona", label: "Cómo funciona" },
            ].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-950">
            Acceso
          </p>
          <ul className="space-y-2">
            <li>
              <Link
                href="/login"
                className="text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300"
              >
                Iniciar sesión
              </Link>
            </li>
            <li>
              <Link
                href="#contacto"
                className="text-sm font-medium text-slate-600 transition hover:text-slate-950 dark:text-slate-300"
              >
                Solicitar demo
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-10 border-t border-slate-100 pt-6">
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          &copy; {new Date().getFullYear()} Manus POS. Todos los derechos
          reservados.
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
