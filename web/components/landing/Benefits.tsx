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
        {/* Left visual - Realistic mobile POS interface */}
        <div className="relative order-2 lg:order-1">
          <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-blue-50 to-slate-50 opacity-60" />
          <div className="relative mx-auto max-w-sm">
            {/* Phone frame */}
            <div className="overflow-hidden rounded-3xl border-4 border-slate-800 bg-slate-800 shadow-2xl">
              {/* Phone notch */}
              <div className="flex items-center justify-center bg-slate-800 py-2">
                <div className="h-5 w-24 rounded-full bg-slate-900" />
              </div>
              
              {/* App content */}
              <div className="bg-white">
                {/* App header */}
                <div className="bg-blue-600 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-200">Minimarket Don José</p>
                      <p className="text-sm font-semibold text-white">Resumen del día</p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-white/20 text-center text-sm font-medium text-white leading-8">JR</div>
                  </div>
                </div>

                {/* Main metrics */}
                <div className="p-4">
                  <div className="mb-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white shadow-lg">
                    <p className="text-xs text-blue-200">Ventas de hoy</p>
                    <p className="text-2xl font-bold">S/ 2,847.50</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded bg-white/20 px-1.5 py-0.5 text-xs font-medium">+18.2% vs ayer</span>
                      <span className="text-xs text-blue-200">42 ventas</span>
                    </div>
                  </div>

                  {/* Quick stats grid */}
                  <div className="mb-4 grid grid-cols-2 gap-2">
                    {[
                      { label: "Efectivo", value: "S/ 1,420", icon: "💵" },
                      { label: "Digital", value: "S/ 1,427", icon: "📱" },
                      { label: "Por cobrar", value: "S/ 245", icon: "⏳" },
                      { label: "Stock bajo", value: "8 items", icon: "⚠️" },
                    ].map(({ label, value, icon }) => (
                      <div key={label} className="rounded-lg border border-slate-100 bg-white p-2.5 shadow-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{icon}</span>
                          <div>
                            <p className="text-xs text-slate-500">{label}</p>
                            <p className="text-sm font-semibold text-slate-900">{value}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Recent activity */}
                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                    <p className="mb-2 text-xs font-semibold text-slate-700">Últimas ventas</p>
                    <div className="space-y-2">
                      {[
                        { time: "14:32", customer: "Cliente general", amount: "S/ 45.50", items: 3 },
                        { time: "14:15", customer: "Juan García", amount: "S/ 120.00", items: 8 },
                        { time: "13:58", customer: "María López", amount: "S/ 32.80", items: 2 },
                      ].map(({ time, customer, amount, items }) => (
                        <div key={time} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                          <div>
                            <p className="text-xs font-medium text-slate-700">{customer}</p>
                            <p className="text-xs text-slate-400">{time} - {items} items</p>
                          </div>
                          <span className="text-sm font-semibold text-emerald-600">{amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom nav */}
                <div className="border-t border-slate-100 bg-white px-4 py-3">
                  <div className="flex items-center justify-around">
                    {[
                      { label: "Inicio", active: true },
                      { label: "POS", active: false },
                      { label: "Stock", active: false },
                      { label: "Más", active: false },
                    ].map(({ label, active }) => (
                      <div key={label} className="flex flex-col items-center gap-1">
                        <div className={`h-5 w-5 rounded-md ${active ? "bg-blue-600" : "bg-slate-200"}`} />
                        <span className={`text-xs ${active ? "font-medium text-blue-600" : "text-slate-400"}`}>{label}</span>
                      </div>
                    ))}
                  </div>
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
