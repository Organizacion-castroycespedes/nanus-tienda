const problems = [
  {
    title: "Desajuste de inventario",
    description:
      "Stock que no coincide con la realidad. Se pierden ventas por falta de stock que no sabías que no tenías.",
    color: "amber",
    visual: (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">Inventario</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            <span className="h-2 w-2 rounded-full bg-red-600" />
            6 alertas
          </span>
        </div>
        <div className="space-y-1.5">
          {[
            { name: "Arroz 1kg", system: 15, real: "0", status: "critical" },
            { name: "Aceite 1L", system: 8, real: "2", status: "critical" },
            { name: "Leche 400g", system: 20, real: "4", status: "warning" },
          ].map(({ name, system, real, status }) => (
            <div key={name} className="flex items-center justify-between rounded-md bg-white px-2 py-1.5">
              <div>
                <p className="text-xs font-medium text-slate-700">{name}</p>
                <p className="text-xs text-slate-400">Sistema: {system} | Real: {real}</p>
              </div>
              <div className={`h-2 w-2 rounded-full ${status === "critical" ? "bg-red-500" : "bg-amber-500"}`} />
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "Sin visibilidad financiera",
    description:
      "No sabes cuánto ganas realmente. Las hojas de cálculo se pierden, los números no cierran y es imposible ver tendencias.",
    color: "red",
    visual: (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">Ingresos vs Gastos</span>
          <span className="text-xs text-red-600 font-medium">❌ No coincide</span>
        </div>
        <div className="space-y-2">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-slate-600">Ingresos (Excel)</span>
              <span className="font-semibold text-slate-900">S/ 4,280</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200">
              <div className="h-full w-full bg-emerald-500 rounded-full" style={{ width: "85%" }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-slate-600">Gastos (Otro archivo)</span>
              <span className="font-semibold text-slate-900">S/ 1,840</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200">
              <div className="h-full bg-orange-500 rounded-full" style={{ width: "45%" }} />
            </div>
          </div>
          <div className="rounded-md bg-white p-2">
            <p className="text-xs text-slate-500">Diferencia: <span className="font-bold text-red-600">S/ 520</span> ¿Dónde está?</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Clientes con deudas perdidas",
    description:
      "Deudas sin registrar, clientes olvidados. Se pierden miles de pesos en cuentas por cobrar que nadie persigue.",
    color: "blue",
    visual: (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">Cuentas por cobrar</span>
          <span className="text-xs font-medium text-red-600">S/ 3,450 perdidos</span>
        </div>
        <div className="space-y-1.5">
          {[
            { name: "Juan García", debt: 450, days: "45 días", overdue: true },
            { name: "María López", debt: 320, days: "62 días", overdue: true },
            { name: "Carlos Ruiz", debt: 180, days: "90 días", overdue: true },
            { name: "??", debt: "???", days: "???", overdue: true },
          ].map(({ name, debt, days, overdue }) => (
            <div key={name} className="flex items-center justify-between rounded-md bg-white px-2 py-1.5">
              <div>
                <p className="text-xs font-medium text-slate-700">{name}</p>
                <p className="text-xs text-slate-400">{days}</p>
              </div>
              <div className="text-right">
                <p className={`text-xs font-semibold ${overdue ? "text-red-600" : "text-slate-600"}`}>
                  {debt}
                </p>
                {overdue && <p className="text-xs text-red-500">Vencido</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: "Compras sin control",
    description:
      "Proveedores duplicados, pedidos perdidos, facturas sin seguimiento. No sabes realmente cuánto gastas.",
    color: "violet",
    visual: (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">Órdenes de compra</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            <span className="h-2 w-2 rounded-full bg-red-600" />
            Desorden
          </span>
        </div>
        <div className="space-y-1">
          {[
            { status: "Perdida?", provider: "Mayorista XYZ", amount: "S/ 450", days: "15 días" },
            { status: "Duplicada", provider: "Distribuidora ABC", amount: "S/ 280", days: "3 días" },
            { status: "Sin factura", provider: "Don José", amount: "S/ 320", days: "8 días" },
            { status: "???", provider: "???", amount: "???", days: "???" },
          ].map(({ status, provider, amount, days }) => (
            <div key={`${status}-${provider}`} className="rounded-md bg-white px-2 py-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-700">{provider}</p>
                  <p className="text-xs text-slate-400">{days}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-900">{amount}</p>
                  <p className={`text-xs ${status.includes("?") ? "text-slate-400" : status === "Perdida?" ? "text-red-600" : status === "Duplicada" ? "text-amber-600" : "text-orange-600"} font-medium`}>
                    {status}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
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
        {problems.map(({ title, description, color, visual }) => (
          <article
            key={title}
            className="group rounded-2xl border border-slate-200 bg-white p-0 overflow-hidden shadow-sm transition hover:shadow-lg"
          >
            {/* Visual section */}
            <div className="bg-gradient-to-br from-slate-50 to-white p-4 border-b border-slate-100">
              {visual}
            </div>

            {/* Text section */}
            <div className="p-5">
              <h3 className="mb-2 text-lg font-semibold text-slate-900">
                {title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-600">
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
