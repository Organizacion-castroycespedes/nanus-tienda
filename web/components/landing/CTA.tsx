import { ArrowRight, MessageCircle } from "lucide-react";
import { getCommercialWhatsAppUrl } from "../../lib/contact-info";

type CTAProps = {
  onRequestDemo: () => void;
};

const CTA = ({ onRequestDemo }: CTAProps) => (
  <section id="contacto" className="bg-blue-700 px-6 py-20 text-white md:py-28">
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-8 rounded-lg border border-white/10 bg-slate-950 p-8 shadow-2xl shadow-blue-950/25 md:p-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <span className="text-sm font-bold uppercase tracking-[0.2em] text-blue-300">
            Da el siguiente paso
          </span>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight md:text-4xl">
            Convierte tu tienda en una operación ordenada, rápida y medible
          </h2>
          <p className="mt-4 max-w-2xl text-pretty text-lg leading-8 text-slate-300">
            Solicita una demo de Manus POS y mira cómo ventas, inventario, caja,
            pedidos y reportes trabajan juntos para darte control real.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <button
            type="button"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={onRequestDemo}
          >
            Solicitar demo
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <a
            href={getCommercialWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/20 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Hablar con Manus POS por WhatsApp"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Hablar por WhatsApp
          </a>
        </div>
      </div>
    </div>
  </section>
);

export default CTA;
