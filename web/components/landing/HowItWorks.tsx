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
        linear-gradient(rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.88)),
        url('/howworks-bg.jpg'),
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
      backgroundColor: "#0f172a",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundSize: "cover",
    }}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-blue-950/85" />

    <div className="relative z-10 mx-auto max-w-6xl">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <div className="max-w-xl">
          <span className="mb-4 inline-block text-sm font-semibold uppercase tracking-widest text-blue-400">
            Como funciona
          </span>
          <h2 className="text-balance text-3xl font-bold text-white md:text-4xl">
            Empieza en tres pasos simples
          </h2>
          <p className="mt-5 max-w-lg text-pretty text-base leading-7 text-slate-400 md:text-lg">
            Sin instalaciones, sin configuraciones complicadas. Configura tu negocio y empieza a operar en minutos.
          </p>

          <div className="mt-10 space-y-6 md:mt-12 md:space-y-7">
            {steps.map(({ number, icon: Icon, title, description }) => (
              <div
                key={number}
                className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
              >
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/40">
                  <Icon className="h-5 w-5 text-blue-400" />
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                    {number.slice(-1)}
                  </span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-white">{title}</h3>
                  <p className="text-sm leading-7 text-slate-400">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 rounded-[2rem] bg-blue-500/10 blur-2xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl">
            <img
              src="/howworks-bg.jpg"
              alt="Vista previa del sistema Manus en uso"
              className="h-[420px] w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <div className="max-w-sm rounded-2xl border border-white/10 bg-slate-950/70 p-5 backdrop-blur-md">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
                  Implementacion rapida
                </p>
                <p className="mt-3 text-xl font-semibold text-white">
                  Visualiza ventas, inventario y operacion desde el primer dia.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default HowItWorks;
