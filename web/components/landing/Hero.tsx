import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  PlayCircle,
  ShoppingCart,
} from "lucide-react";

const chips = [
  { label: "POS", icon: ShoppingCart },
  { label: "Inventario", icon: Boxes },
  { label: "Caja", icon: CreditCard },
  { label: "Pedidos", icon: ClipboardList },
  { label: "Reportes", icon: BarChart3 },
];

type HeroProps = {
  onRequestDemo: () => void;
};

const Hero = ({ onRequestDemo }: HeroProps) => (
  <section id="inicio" className="relative isolate overflow-hidden bg-slate-950">
    <Image
      src="/images/home/manus-pos-hero-landing.png"
      alt="Pantallas de Manus POS para ventas, inventario, caja y reportes"
      fill
      priority
      sizes="100vw"
      className="absolute inset-0 -z-20 h-full w-full object-cover object-[62%_28%]"
    />
    <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(2,6,23,0.94)_0%,rgba(15,23,42,0.84)_36%,rgba(15,23,42,0.36)_67%,rgba(15,23,42,0.1)_100%)]" />
    <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-[linear-gradient(180deg,rgba(2,6,23,0)_0%,rgba(248,250,252,1)_100%)]" />

    <div className="mx-auto flex min-h-[760px] max-w-6xl items-center px-6 pb-24 pt-32 sm:min-h-[820px] lg:min-h-[760px]">
      <div className="max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100 backdrop-blur">
          Manus POS v0.0.1
        </span>

        <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.04] tracking-tight text-white sm:text-5xl lg:text-6xl">
          Controla ventas, inventario, caja y pedidos desde un solo lugar
        </h1>

        <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-slate-200 sm:text-xl">
          Manus POS ayuda a tiendas, minimarkets y negocios a operar más
          rápido, vender mejor y tener control total de su negocio en tiempo
          real.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={onRequestDemo}
          >
            <PlayCircle className="h-5 w-5" aria-hidden="true" />
            Solicitar demo
          </button>
          <Link
            href="#funcionalidades"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Ver funcionalidades
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {chips.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 backdrop-blur"
            >
              <Icon className="h-4 w-4 text-blue-200" aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>

        <dl className="mt-10 grid max-w-xl grid-cols-3 gap-3 text-white">
          {[
            { value: "1", label: "sistema" },
            { value: "8", label: "módulos clave" },
            { value: "24/7", label: "acceso web" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-white/10 bg-white/10 px-4 py-3 backdrop-blur"
            >
              <dt className="text-2xl font-bold">{item.value}</dt>
              <dd className="mt-1 text-xs font-medium text-slate-300">
                {item.label}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  </section>
);

export default Hero;
