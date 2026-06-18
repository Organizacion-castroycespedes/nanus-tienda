import Link from "next/link";
import Image from "next/image";

const Footer = () => (
  <footer className="border-t border-slate-200 bg-white px-6 py-12">
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-8 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
              <Image
                src="/LogoManus.png.jpeg"
                alt="Manus POS"
                width={40}
                height={40}
                className="h-full w-full object-contain"
              />
            </span>
            <span className="text-lg font-bold text-slate-950">
              Manus <span className="text-blue-700">POS</span>
            </span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">
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
                  className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
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
                className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
              >
                Iniciar sesión
              </Link>
            </li>
            <li>
              <Link
                href="#contacto"
                className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
              >
                Solicitar demo
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-10 border-t border-slate-100 pt-6">
        <p className="text-center text-xs text-slate-500">
          &copy; {new Date().getFullYear()} Manus POS. Todos los derechos
          reservados.
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
