import { AlertCircle, TrendingDown, Users, ReceiptText } from "lucide-react";

const problems = [
  {
    icon: AlertCircle,
    title: "Desajuste de inventario",
    description:
      "Stock que no coincide con la realidad. Se pierden ventas por falta de stock que no sabías que no tenías.",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  {
    icon: TrendingDown,
    title: "Sin visibilidad financiera",
    description:
      "No sabes cuánto ganas realmente. Las hojas de cálculo se pierden, los números no cierran y es imposible ver tendencias.",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  {
    icon: Users,
    title: "Clientes con deudas perdidas",
    description:
      "Deudas sin registrar, clientes olvidados. Se pierden miles de pesos en cuentas por cobrar que nadie persigue.",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  {
    icon: ReceiptText,
    title: "Compras sin control",
    description:
      "Proveedores duplicados, pedidos perdidos, facturas sin seguimiento. No sabes realmente cuánto gastas.",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
  },
];

const Problems = () => (
  <section className="bg-white px-6 py-20 md:py-28">
    <div className="mx-auto max-w-6xl">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-widest text-red-600">
          Los problemas que resolvemos
        </span>
        <h2 className="text-balance text-3xl font-bold text-slate-900 md:text-4xl">
          ¿Reconoces alguno de estos?
        </h2>
        <p className="mt-4 text-pretty text-lg text-slate-600">
          La mayoría de minimarkets y tiendas lucha con estos mismos problemas. Manus los elimina.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {problems.map(({ icon: Icon, title, description, color, bg, border }) => (
          <article
            key={title}
            className={`rounded-2xl border-2 p-6 transition hover:shadow-md ${border} group relative overflow-hidden bg-white`}
          >
            {/* Subtle background accent */}
            <div className={`absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 rounded-full opacity-30 ${bg}`} />
            
            <div className="relative z-10">
              <div className={`mb-4 inline-flex rounded-xl p-2.5 ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-900">
                {title}
              </h3>
              <p className="text-base leading-relaxed text-slate-600">
                {description}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default Problems;
