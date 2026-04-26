import Link from "next/link";

const Footer = () => (
  <footer className="border-t border-slate-200 bg-white px-6 py-12">
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-8 md:grid-cols-4">
        {/* Brand */}
        <div className="md:col-span-2">
          <Link href="/" className="mb-4 inline-flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/LogoManus.png-AQn35KrUXzECzcI6dhjsq3tPKsUTFa.jpeg"
              alt="Manus POS"
              className="h-12 w-auto object-contain"
            />
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
