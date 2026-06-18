import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";

const CTA = () => (
  <section
    id="contacto"
    className="relative overflow-hidden bg-blue-600 px-6 py-20 md:py-28"
  >
    <div
      className="pointer-events-none absolute inset-0 opacity-10"
      style={{
        backgroundImage:
          "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }}
    />
    <div className="relative z-10 mx-auto max-w-3xl text-center">
      <h2 className="text-balance text-3xl font-bold text-white md:text-4xl lg:text-5xl">
        Lleva el control de tu negocio con Manus POS
      </h2>
      <p className="mt-5 text-pretty text-lg text-blue-100">
        Agenda una demo y descubre cómo ordenar tus ventas, inventario, caja y
        pedidos en un solo sistema.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="mailto:contacto@manus.com?subject=Solicitar%20demo%20Manus%20POS"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-blue-700 shadow-md transition hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Solicitar demo
          <ArrowRight className="h-4 w-4" />
        </Link>
        <a
          href="https://wa.me/51999999999?text=Hola%2C%20quiero%20conocer%20Manus%20POS"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/10 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <MessageCircle className="h-4 w-4" />
          Hablar por WhatsApp
        </a>
      </div>
      <p className="mt-4 text-sm text-blue-200">
        Te respondemos y te mostramos el sistema funcionando.
      </p>
    </div>
  </section>
);

export default CTA;
