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
  <section className="relative overflow-hidden bg-slate-900 px-6 py-20 md:py-28">
    {/* Background pattern - business/retail elements */}
    <div className="absolute inset-0 opacity-5">
      <svg className="h-full w-full" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        {/* Grid pattern */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(59, 130, 246, 0.3)" strokeWidth="0.5"/>
          </pattern>
          <linearGradient id="fadeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor: "rgba(59, 130, 246, 0.1)", stopOpacity: 1}} />
            <stop offset="100%" style={{stopColor: "rgba(99, 102, 241, 0.05)", stopOpacity: 1}} />
          </linearGradient>
        </defs>
        
        {/* Background elements */}
        <rect width="1200" height="800" fill="url(#fadeGradient)" />
        <rect width="1200" height="800" fill="url(#grid)" />
        
        {/* Subtle icons scattered in background */}
        {/* Shopping cart icons */}
        <g opacity="0.08">
          <text x="100" y="150" fontSize="80" fill="rgba(59, 130, 246, 0.3)">🛒</text>
          <text x="900" y="650" fontSize="80" fill="rgba(99, 102, 241, 0.3)">🛒</text>
        </g>
        
        {/* Building/store icons */}
        <g opacity="0.08">
          <text x="800" y="100" fontSize="80" fill="rgba(59, 130, 246, 0.3)">🏪</text>
          <text x="150" y="700" fontSize="80" fill="rgba(99, 102, 241, 0.3)">🏪</text>
        </g>
        
        {/* Package/box icons */}
        <g opacity="0.08">
          <text x="500" y="200" fontSize="80" fill="rgba(59, 130, 246, 0.3)">📦</text>
          <text x="650" y="700" fontSize="80" fill="rgba(99, 102, 241, 0.3)">📦</text>
        </g>
        
        {/* Chart/graph icons */}
        <g opacity="0.08">
          <text x="300" y="500" fontSize="80" fill="rgba(59, 130, 246, 0.3)">📊</text>
          <text x="1000" y="300" fontSize="80" fill="rgba(99, 102, 241, 0.3)">📊</text>
        </g>
      </svg>
    </div>

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
