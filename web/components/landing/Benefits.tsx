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
        {/* Left visual */}
        <div className="relative order-2 lg:order-1">
          <div className="absolute -inset-6 rounded-3xl bg-slate-50" />
          <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
            <p className="mb-4 text-sm font-semibold text-slate-500">
              Resumen del dia
            </p>
            <div className="space-y-3">
              {[
                { label: "Ventas realizadas", value: "34", color: "bg-blue-500" },
                { label: "Ingresos totales", value: "$4,280", color: "bg-emerald-500" },
                { label: "Productos vendidos", value: "127", color: "bg-amber-500" },
                { label: "Clientes atendidos", value: "28", color: "bg-violet-500" },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${color}`} />
                    <span className="text-sm text-slate-700">{label}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-blue-600 px-4 py-3 text-center">
              <p className="text-xs font-semibold text-blue-100">
                Negocio funcionando correctamente
              </p>
              <p className="mt-0.5 text-xl font-bold text-white">Todo bajo control</p>
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
