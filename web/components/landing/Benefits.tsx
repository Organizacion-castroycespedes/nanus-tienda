import {
  Gauge,
  ShieldCheck,
  Zap,
  LayoutGrid,
  LineChart,
} from "lucide-react";

const benefits = [
  {
    icon: Gauge,
    title: "Más control",
    description:
      "Ve el estado de tu negocio en cualquier momento: ventas, stock y caja.",
  },
  {
    icon: ShieldCheck,
    title: "Menos errores",
    description:
      "Cálculos automáticos y stock en tiempo real reducen las equivocaciones.",
  },
  {
    icon: Zap,
    title: "Operación más rápida",
    description:
      "Cobra, repón y atiende en menos tiempo con flujos pensados para tu día.",
  },
  {
    icon: LayoutGrid,
    title: "Información centralizada",
    description:
      "Toda tu operación en un solo lugar, sin hojas de cálculo dispersas.",
  },
  {
    icon: LineChart,
    title: "Mejor seguimiento",
    description:
      "Da seguimiento a pedidos, clientes y movimientos sin perder detalle.",
  },
];

const Benefits = () => (
  <section id="beneficios" className="bg-white px-6 py-20 md:py-28">
    <div className="mx-auto max-w-6xl">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-widest text-blue-600">
          Beneficios
        </span>
        <h2 className="text-balance text-3xl font-bold text-slate-900 md:text-4xl">
          Lo que tu negocio gana con Manus
        </h2>
        <p className="mt-4 text-pretty text-lg text-slate-600">
          Más que un sistema de ventas: una forma más ordenada y profesional de
          operar tu negocio.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {benefits.map(({ icon: Icon, title, description }) => (
          <article
            key={title}
            className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {description}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default Benefits;
