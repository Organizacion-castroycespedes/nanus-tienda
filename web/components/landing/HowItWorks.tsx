import { Building2, Package, ShoppingCart } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Building2,
    title: "Configura tu negocio",
    description:
      "Crea tu cuenta, define tu empresa, agrega tus sucursales y configura roles de usuario en minutos.",
  },
  {
    number: "02",
    icon: Package,
    title: "Agrega productos y clientes",
    description:
      "Carga tu catalogo de productos con impuestos y unidades. Registra tus clientes y proveedores.",
  },
  {
    number: "03",
    icon: ShoppingCart,
    title: "Empieza a vender y rastrear",
    description:
      "Usa el POS para ventas rapidas. El inventario se actualiza solo. Monitorea todo en tiempo real.",
  },
];

const HowItWorks = () => (
  <section 
    className="relative overflow-hidden bg-slate-900 px-6 py-20 md:py-28"
    style={{
      backgroundImage: `
        linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(99, 102, 241, 0.04) 50%, rgba(30, 27, 75, 0.06) 100%),
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 50px,
          rgba(59, 130, 246, 0.03) 50px,
          rgba(59, 130, 246, 0.03) 51px
        ),
        repeating-linear-gradient(
          90deg,
          transparent,
          transparent 50px,
          rgba(99, 102, 241, 0.03) 50px,
          rgba(99, 102, 241, 0.03) 51px
        )
      `,
      backgroundColor: '#0f172a',
    }}
  >
    {/* Subtle animated overlay gradient */}
    <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-blue-950/85" />

    <div className="relative z-10 mx-auto max-w-6xl">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-widest text-blue-400">
          Como funciona
        </span>
        <h2 className="text-balance text-3xl font-bold text-white md:text-4xl">
          Empieza en tres pasos simples
        </h2>
        <p className="mt-4 text-pretty text-lg text-slate-400">
          Sin instalaciones, sin configuraciones complicadas. Listo en minutos.
        </p>
      </div>
      <div className="relative grid gap-8 md:grid-cols-3">
        {/* Connector line */}
        <div className="absolute left-0 right-0 top-8 hidden h-px bg-white/10 md:block" />
        {steps.map(({ number, icon: Icon, title, description }) => (
          <div key={number} className="relative flex flex-col items-center text-center">
            <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Icon className="h-6 w-6 text-blue-400" />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                {number.slice(-1)}
              </span>
            </div>
            <h3 className="mb-2 text-base font-semibold text-white">{title}</h3>
            <p className="text-sm leading-relaxed text-slate-400">{description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
