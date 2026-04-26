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
    icon: ShoppingCart,
    title: "Punto de Venta (POS)",
    description:
      "Registra ventas rapido, aplica descuentos, gestiona metodos de pago y genera comprobantes al instante.",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
  },
  {
    icon: Package,
    title: "Control de Inventario",
    description:
      "Stock actualizado en tiempo real con cada venta y recepcion de mercancia. Alertas de stock minimo.",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
  },
  {
    icon: Truck,
    title: "Compras y Proveedores",
    description:
      "Registra pedidos, recepciona mercancia y lleva el historial completo de tus proveedores.",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
  },
  {
    icon: Users,
    title: "Gestion de Clientes",
    description:
      "CRM basico con historial de compras, datos de contacto y seguimiento de cuentas por cobrar.",
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-100",
  },
  {
    icon: Wallet,
    title: "Finanzas y Cuentas",
    description:
      "Cuentas por cobrar y pagar, pagos parciales, saldos y sobrepagos. Todo bajo control.",
    color: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-100",
  },
  {
    icon: BarChart2,
    title: "Reportes y Visibilidad",
    description:
      "Dashboards con ventas, ingresos y movimientos para tomar decisiones con datos reales.",
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-100",
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
        {features.map(({ icon: Icon, title, description, color, bg, border }) => (
          <article
            key={title}
            className={`group rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md ${border}`}
          >
            <div className={`mb-4 inline-flex rounded-xl p-2.5 ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
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
