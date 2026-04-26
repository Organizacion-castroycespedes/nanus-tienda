import { CheckCircle } from "lucide-react";

const benefits = [
  {
    title: "Ahorra tiempo",
    description:
      "Automatiza el registro de ventas, inventario y cobros. Menos tiempo en papeles, mas tiempo para tu negocio.",
  },
  {
    title: "Reduce errores",
    description:
      "Calculos automaticos, stock en tiempo real y alertas te ayudan a evitar errores costosos.",
  },
  {
    title: "Visibilidad total",
    description:
      "Ve el estado de tu negocio en cualquier momento: ventas, deudas, stock y reportes desde un solo panel.",
  },
  {
    title: "Facil de usar",
    description:
      "Interfaz intuitiva disenada para duenos de negocios, no para tecnicos. Sin curva de aprendizaje.",
  },
];

const Benefits = () => (
  <section className="bg-white px-6 py-20 md:py-28">
    <div className="mx-auto max-w-6xl">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        {/* Left visual - Premium dashboard */}
        <div className="relative order-2 lg:order-1">
          <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-blue-50 to-slate-50 opacity-60" />
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              {/* Header */}
              <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
                <p className="text-xs font-semibold text-slate-600">Resumen ejecutivo - Hoy</p>
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                {/* Key metrics */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Ventas", value: "$2,480", icon: "📊", trend: "+18%" },
                    { label: "Neto", value: "$1,240", icon: "💵", trend: "+12%" },
                  ].map(({ label, value, icon, trend }) => (
                    <div
                      key={label}
                      className="rounded-lg border border-slate-100 bg-gradient-to-br from-blue-50 to-white p-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-slate-600">{label}</p>
                          <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
                        </div>
                        <div className="text-2xl">{icon}</div>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-emerald-600">{trend} vs ayer</p>
                    </div>
                  ))}
                </div>

                {/* Activity list */}
                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <p className="mb-2 text-xs font-semibold text-slate-700">Últimas transacciones</p>
                  <div className="space-y-2">
                    {[
                      { type: "Venta", amount: "$45.50", icon: "🛒" },
                      { type: "Pago", amount: "$120.00", icon: "✓" },
                      { type: "Compra", amount: "$250.00", icon: "📦" },
                    ].map(({ type, amount, icon }) => (
                      <div key={type} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span>{icon}</span>
                          <span className="text-slate-700">{type}</span>
                        </div>
                        <span className="font-semibold text-slate-900">{amount}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status badge */}
                <div className="rounded-lg bg-gradient-to-r from-emerald-50 to-green-50 p-3">
                  <p className="text-xs text-emerald-800">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <span className="h-2 w-2 rounded-full bg-emerald-600" />
                      Negocio en línea
                    </span>
                  </p>
                  <p className="mt-1 text-sm font-bold text-emerald-900">Todo bajo control</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: benefits list */}
        <div className="order-1 lg:order-2">
          <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-widest text-blue-600">
            Beneficios
          </span>
          <h2 className="text-balance text-3xl font-bold text-slate-900 md:text-4xl">
            Diseñado para hacer tu vida mas facil
          </h2>
          <p className="mt-4 text-pretty text-lg text-slate-600">
            Manus te da las herramientas que necesitas sin la complejidad que
            no necesitas.
          </p>
          <ul className="mt-8 space-y-5">
            {benefits.map(({ title, description }) => (
              <li key={title} className="flex gap-4">
                <div className="mt-0.5 shrink-0">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);

export default Benefits;
