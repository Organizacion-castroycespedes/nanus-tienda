import Link from "next/link";
import { ArrowRight } from "lucide-react";

const CTA = () => (
  <section className="relative overflow-hidden bg-blue-600 px-6 py-20 md:py-28">
    {/* Background: Manus logo watermark */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/LogoManus.png-AQn35KrUXzECzcI6dhjsq3tPKsUTFa.jpeg"
      alt=""
      aria-hidden="true"
      className="absolute inset-0 h-full w-full object-cover object-center opacity-10 mix-blend-overlay"
    />
    {/* Gradient overlay so text stays crisp */}
    <div className="absolute inset-0 bg-gradient-to-tr from-blue-700/70 via-transparent to-blue-500/40" />
    <div className="relative z-10 mx-auto max-w-3xl text-center">
      <h2 className="text-balance text-3xl font-bold text-white md:text-4xl lg:text-5xl">
        Lleva tu negocio al siguiente nivel
      </h2>
      <p className="mt-5 text-pretty text-lg text-blue-100">
        Unete a cientos de emprendedores que ya gestionan sus negocios con
        Manus. Empieza hoy, gratis.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-blue-700 shadow-md transition hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Crear cuenta gratis
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/10 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Iniciar sesion
        </Link>
      </div>
      <p className="mt-4 text-sm text-blue-200">
        Sin tarjeta de credito. Sin compromisos.
      </p>
    </div>
  </section>
);

export default CTA;
