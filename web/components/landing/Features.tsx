import {
  BarChart2,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

const features = [
  {
    title: "Punto de Venta (POS)",
    description:
      "Registra ventas rapido, aplica descuentos, gestiona metodos de pago y genera comprobantes al instante.",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
    visual: (
      <div className="space-y-2">
        <div className="rounded-lg bg-white p-2">
          <p className="mb-1 text-xs font-semibold text-slate-700">Carrito de compras</p>
          <div className="space-y-1">
            {["Arroz 1kg - $3.50", "Aceite 1L - $8.00", "Pan - $1.50"].map((item) => (
              <div key={item} className="flex justify-between text-xs text-slate-600">
                <span>{item}</span>
                <span className="font-semibold">$</span>
              </div>
            ))}
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2">
            <div className="flex justify-between text-xs font-bold text-slate-900">
              <span>Total</span>
              <span>$13.00</span>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Control de Inventario",
    description:
      "Stock actualizado en tiempo real con cada venta y recepcion de mercancia. Alertas de stock minimo.",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    visual: (
      <div className="space-y-1">
        {[
          { name: "Arroz", stock: 25, min: 20, status: "ok" },
          { name: "Aceite", stock: 8, min: 15, status: "low" },
          { name: "Pan", stock: 45, min: 20, status: "ok" },
        ].map(({ name, stock, min, status }) => (
          <div key={name} className="rounded-lg bg-white p-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">{name}</span>
              <span className={`text-xs font-semibold ${status === "low" ? "text-amber-600" : "text-emerald-600"}`}>
                {stock} un
              </span>
            </div>
            <div className="mt-0.5 h-1 w-full rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${status === "low" ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${(stock / (min + 15)) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Compras y Proveedores",
    description:
      "Registra pedidos, recepciona mercancia y lleva el historial completo de tus proveedores.",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
    visual: (
      <div className="rounded-lg bg-white p-2">
        <p className="mb-1.5 text-xs font-semibold text-slate-700">Orden #1024</p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-600">Proveedor</span>
            <span className="font-medium">Mayorista XYZ</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Estado</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 font-medium text-blue-700">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              Pendiente
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Total</span>
            <span className="font-semibold">$450.00</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Gestion de Clientes",
    description:
      "CRM basico con historial de compras, datos de contacto y seguimiento de cuentas por cobrar.",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-100",
    visual: (
      <div className="space-y-1">
        {[
          { name: "Juan García", balance: 120, status: "cobrar" },
          { name: "María López", balance: 0, status: "pagado" },
          { name: "Pedro Ruiz", balance: 85, status: "cobrar" },
        ].map(({ name, balance, status }) => (
          <div key={name} className="rounded-lg bg-white p-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">{name}</span>
              <span className={`font-semibold ${status === "cobrar" ? "text-rose-600" : "text-emerald-600"}`}>
                ${balance}
              </span>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Finanzas y Cuentas",
    description:
      "Cuentas por cobrar y pagar, pagos parciales, saldos y sobrepagos. Todo bajo control.",
    color: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-100",
    visual: (
      <div className="space-y-1">
        {[
          { label: "Ventas", value: "$2,480", color: "emerald" },
          { label: "Gastos", value: "$680", color: "rose" },
          { label: "Neto", value: "$1,800", color: "blue" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <div className={`h-2 w-2 rounded-full bg-${color}-500`} />
            <span className="text-slate-600">{label}</span>
            <span className="ml-auto font-semibold text-slate-900">{value}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Reportes y Visibilidad",
    description:
      "Dashboards con ventas, ingresos y movimientos para tomar decisiones con datos reales.",
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-100",
    visual: (
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-700">Ventas últimos 7 días</p>
        <div className="flex items-end gap-1" style={{ height: 48 }}>
          {[30, 45, 35, 60, 50, 75, 85].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-gradient-to-t from-sky-600 to-sky-400"
              style={{ height: `${h}%`, opacity: 0.6 + (i / 7) * 0.4 }}
            />
          ))}
        </div>
      </div>
    ),
  },
];

const Features = () => (
  <section id="features" className="bg-slate-50 px-6 py-20 md:py-28">
    <div className="mx-auto max-w-6xl">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-widest text-blue-600">
          Funcionalidades
        </span>
        <h2 className="text-balance text-3xl font-bold text-slate-900 md:text-4xl">
          Todo lo que tu negocio necesita
        </h2>
        <p className="mt-4 text-pretty text-lg text-slate-600">
          Una suite completa de herramientas pensada para minimarkets,
          tiendas y emprendedores.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ title, description, color, bg, border, visual }) => (
          <article
            key={title}
            className={`group rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md ${border}`}
          >
            <div className="mb-4 min-h-32">
              <div className={`rounded-lg ${bg} p-3 text-slate-800`}>
                {visual}
              </div>
            </div>
            <h3 className="mb-2 text-base font-semibold text-slate-900">
              {title}
            </h3>
            <p className="text-sm leading-relaxed text-slate-600">
              {description}
            </p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
