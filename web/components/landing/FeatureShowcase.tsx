import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

const PosPreview = () => (
  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:bg-slate-800 dark:border-slate-700">
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
          POS
        </p>
        <p className="text-lg font-bold text-slate-950">Venta rápida</p>
      </div>
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        Caja abierta
      </span>
    </div>
    <div className="grid gap-4 p-5 md:grid-cols-[1fr_220px]">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {["Café", "Arroz", "Aceite", "Leche", "Pan", "Snacks"].map((item) => (
          <div
            key={item}
            className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-4 text-center text-sm font-semibold text-slate-700 dark:text-slate-200"
          >
            {item}
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-slate-950 p-4 text-white">
        <p className="text-xs text-slate-300">Total</p>
        <p className="mt-1 text-3xl font-bold">$ 38.400</p>
        <button className="mt-5 w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-bold text-white">
          Cobrar
        </button>
      </div>
    </div>
  </div>
);

const InventoryPreview = () => (
  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:bg-slate-800 dark:border-slate-700">
    <div className="border-b border-slate-100 px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
        Inventario
      </p>
      <p className="text-lg font-bold text-slate-950">Stock por producto</p>
    </div>
    <div className="space-y-3 p-5">
      {[
        { name: "Arroz flor 1kg", stock: "65", badge: "En stock", tone: "emerald" },
        { name: "Aceite ideal 1L", stock: "20", badge: "Stock bajo", tone: "amber" },
        { name: "Leche gloria 1L", stock: "8", badge: "Reponer", tone: "rose" },
      ].map((item) => (
        <div
          key={item.name}
          className="grid grid-cols-[1fr_70px_94px] items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
        >
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.name}</p>
          <p className="text-right text-sm font-bold text-slate-950">
            {item.stock}
          </p>
          <span
            className={`rounded-full px-2 py-1 text-center text-xs font-bold ${
              item.tone === "emerald"
                ? "bg-emerald-50 text-emerald-700"
                : item.tone === "amber"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-rose-50 text-rose-700"
            }`}
          >
            {item.badge}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const CashPreview = () => (
  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:bg-slate-800 dark:border-slate-700">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
      Caja
    </p>
    <p className="mt-1 text-lg font-bold text-slate-950">Turno actual</p>
    <div className="mt-5 rounded-lg bg-slate-950 p-5 text-white">
      <p className="text-sm text-slate-300">Esperado en caja</p>
      <p className="mt-1 text-4xl font-bold">$ 1.250.800</p>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="rounded-lg bg-emerald-50 p-4">
        <p className="text-xs font-semibold text-emerald-700">Ingresos</p>
        <p className="mt-1 text-xl font-bold text-emerald-950">$ 980.000</p>
      </div>
      <div className="rounded-lg bg-rose-50 p-4">
        <p className="text-xs font-semibold text-rose-700">Egresos</p>
        <p className="mt-1 text-xl font-bold text-rose-950">$ 120.000</p>
      </div>
    </div>
  </div>
);

const OrdersPreview = () => (
  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:bg-slate-800 dark:border-slate-700">
    <div className="border-b border-slate-100 px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
        Pedidos / clientes
      </p>
      <p className="text-lg font-bold text-slate-950">Seguimiento diario</p>
    </div>
    <div className="space-y-3 p-5">
      {[
        { name: "Tienda Castro", state: "Listo", color: "emerald" },
        { name: "Cliente mostrador", state: "En preparación", color: "blue" },
        { name: "Pedido telefónico", state: "Pendiente", color: "slate" },
      ].map((item) => (
        <div
          key={item.name}
          className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
        >
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.name}</p>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              item.color === "emerald"
                ? "bg-emerald-50 text-emerald-700"
                : item.color === "blue"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-slate-200 text-slate-700"
            } dark:text-slate-200`}
          >
            {item.state}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const ReportsPreview = () => (
  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:bg-slate-800 dark:border-slate-700">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
      Reportes
    </p>
    <p className="mt-1 text-lg font-bold text-slate-950">Ventas del día</p>
    <p className="mt-4 text-4xl font-bold text-slate-950">$ 2.150.800</p>
    <div className="mt-5 flex h-28 items-end gap-2">
      {[36, 54, 48, 72, 62, 90, 78].map((height, index) => (
        <div
          key={index}
          className="flex-1 rounded-t bg-blue-600"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
    <div className="mt-3 grid grid-cols-3 gap-3 text-center">
      {["POS", "Compras", "Caja"].map((item) => (
        <span
          key={item}
          className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
        >
          {item}
        </span>
      ))}
    </div>
  </div>
);

type ShowcaseBlock = {
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  preview: ReactNode;
};

const blocks: ShowcaseBlock[] = [
  {
    eyebrow: "POS",
    title: "Cobra rápido y sigue vendiendo",
    description:
      "El punto de venta está pensado para el ritmo real de una tienda: seleccionar productos, revisar totales y cobrar sin perder tiempo.",
    points: ["Búsqueda rápida", "Totales claros", "Caja conectada"],
    preview: <PosPreview />,
  },
  {
    eyebrow: "Inventario",
    title: "Sabe qué tienes, qué falta y qué se mueve",
    description:
      "Cada venta y recepción alimenta el inventario para que el equipo compre mejor y evite quedarse sin productos clave.",
    points: ["Stock actualizado", "Alertas operativas", "Lotes y ubicaciones"],
    preview: <InventoryPreview />,
  },
  {
    eyebrow: "Caja",
    title: "Turnos y movimientos bajo control",
    description:
      "Aperturas, cierres, ingresos y egresos quedan organizados para que el cierre del día sea claro.",
    points: ["Apertura de caja", "Movimientos trazables", "Cierre de turno"],
    preview: <CashPreview />,
  },
  {
    eyebrow: "Pedidos / clientes",
    title: "Da seguimiento sin perder solicitudes",
    description:
      "Pedidos y clientes viven junto a la operación comercial para vender, entregar y registrar con más orden.",
    points: ["Pedidos por estado", "Clientes frecuentes", "Venta desde pedido"],
    preview: <OrdersPreview />,
  },
  {
    eyebrow: "Reportes",
    title: "Mira el negocio con datos frescos",
    description:
      "Reportes de ventas, compras, caja y pedidos ayudan a tomar decisiones sin esperar cierres manuales.",
    points: ["Ventas por período", "Tickets PDF", "Resumen operativo"],
    preview: <ReportsPreview />,
  },
];

const FeatureShowcase = () => (
  <section className="bg-white px-6 py-20 md:py-28">
    <div className="mx-auto max-w-6xl">
      <div className="mb-14 max-w-3xl">
        <span className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
          Vista funcional
        </span>
        <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
          Manus POS se siente como una operación completa, no como una caja suelta
        </h2>
      </div>

      <div className="space-y-16 md:space-y-24">
        {blocks.map((block, index) => {
          const reversed = index % 2 === 1;
          return (
            <article
              key={block.title}
              className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16"
            >
              <div className={reversed ? "lg:order-2" : ""}>
                <span className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
                  {block.eyebrow}
                </span>
                <h3 className="mt-3 text-balance text-2xl font-bold text-slate-950 md:text-3xl">
                  {block.title}
                </h3>
                <p className="mt-4 text-pretty text-lg leading-8 text-slate-600 dark:text-slate-300">
                  {block.description}
                </p>
                <ul className="mt-6 grid gap-3">
                  {block.points.map((point) => (
                    <li key={point} className="flex items-center gap-3">
                      <CheckCircle2
                        className="h-5 w-5 shrink-0 text-emerald-600"
                        aria-hidden="true"
                      />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {point}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={reversed ? "lg:order-1" : ""}>{block.preview}</div>
            </article>
          );
        })}
      </div>
    </div>
  </section>
);

export default FeatureShowcase;
