import {
  BarChart3,
  Boxes,
  Building2,
  Package,
  ShoppingCart,
} from "lucide-react";

const steps = [
  {
    icon: Building2,
    title: "Configura tu negocio",
    description:
      "Crea tu cuenta, define tu empresa, impuestos y usuarios en minutos.",
  },
  {
    icon: Package,
    title: "Registra productos y clientes",
    description:
      "Carga tu catálogo, tus precios y los datos de clientes y proveedores.",
  },
  {
    icon: ShoppingCart,
    title: "Vende desde el POS",
    description:
      "Cobra rápido en el mostrador con efectivo, tarjeta o billeteras.",
  },
  {
    icon: Boxes,
    title: "Controla inventario y caja",
    description:
      "El stock se actualiza solo y la caja queda cuadrada en cada turno.",
  },
  {
    icon: BarChart3,
    title: "Consulta tus reportes",
    description:
      "Revisa ventas y movimientos para tomar mejores decisiones.",
  },
];

const HowItWorks = () => (
  <section id="como-funciona" className="bg-slate-900 px-6 py-20 md:py-28">
    <div className="mx-auto max-w-6xl">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-widest text-blue-400">
          Cómo funciona
        </span>
        <h2 className="text-balance text-3xl font-bold text-white md:text-4xl">
          Empieza a operar en cinco pasos
        </h2>
        <p className="mt-4 text-pretty text-lg text-slate-400">
          Sin instalaciones complicadas. Configura tu negocio y empieza a
          vender el mismo día.
        </p>
      </div>

      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map(({ icon: Icon, title, description }, index) => (
          <li
            key={title}
            className="relative flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-2xl font-bold text-white/20">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {description}
            </p>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

export default HowItWorks;
