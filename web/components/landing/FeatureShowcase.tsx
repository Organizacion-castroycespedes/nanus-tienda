import type { ReactNode } from "react";
import { Check } from "lucide-react";

/* --- Mockups (lightweight product previews, no heavy tables) --- */

const PosMockup = () => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-sm font-semibold text-slate-900">Nueva venta</p>
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        Caja abierta
      </span>
    </div>
    <div className="grid grid-cols-3 gap-2 p-4">
      {["Gaseosa", "Pan", "Arroz", "Aceite", "Leche", "Snacks"].map((p, i) => (
        <div
          key={p}
          className={`rounded-lg border px-2 py-3 text-center text-xs font-medium ${
            i === 0
              ? "border-blue-200 bg-blue-50 text-blue-700"
              : "border-slate-100 bg-slate-50 text-slate-600"
          }`}
        >
          {p}
        </div>
      ))}
    </div>
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
      <span className="text-xs text-slate-500">3 productos</span>
      <span className="text-base font-bold text-slate-900">S/ 24.90</span>
    </div>
  </div>
);

const InventoryMockup = () => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
    <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-sm font-semibold text-slate-900">Inventario</p>
    </div>
    <div className="space-y-2 p-4">
      {[
        { name: "Arroz Costeño 1kg", stock: "45 un", tone: "ok" },
        { name: "Aceite Primor 1L", stock: "8 un", tone: "low" },
        { name: "Azúcar Rubia 1kg", stock: "3 un", tone: "crit" },
      ].map(({ name, stock, tone }) => (
        <div
          key={name}
          className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
        >
          <p className="text-xs font-medium text-slate-700">{name}</p>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              tone === "ok"
                ? "bg-emerald-50 text-emerald-700"
                : tone === "low"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-rose-50 text-rose-700"
            }`}
          >
            {stock}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const CashMockup = () => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
    <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-sm font-semibold text-slate-900">Caja del día</p>
    </div>
    <div className="p-4">
      <div className="rounded-xl bg-blue-600 p-4 text-white">
        <p className="text-xs text-blue-100">Saldo en caja</p>
        <p className="mt-1 text-2xl font-bold">S/ 2,847.50</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          { label: "Ingresos", value: "S/ 3,120" },
          { label: "Egresos", value: "S/ 272" },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
          >
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-sm font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const OrdersMockup = () => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
    <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-sm font-semibold text-slate-900">Pedidos</p>
    </div>
    <div className="space-y-2 p-4">
      {[
        { client: "Juan García", state: "Listo", tone: "ok" },
        { client: "María López", state: "En preparación", tone: "wip" },
        { client: "Carlos Ruiz", state: "Pendiente", tone: "pend" },
      ].map(({ client, state, tone }) => (
        <div
          key={client}
          className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
        >
          <p className="text-xs font-medium text-slate-700">{client}</p>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              tone === "ok"
                ? "bg-emerald-50 text-emerald-700"
                : tone === "wip"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {state}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const ReportsMockup = () => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
    <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-sm font-semibold text-slate-900">Ventas de la semana</p>
    </div>
    <div className="p-4">
      <p className="text-2xl font-bold text-slate-900">S/ 8,547.80</p>
      <p className="text-xs font-medium text-emerald-600">+22% vs semana anterior</p>
      <div className="mt-4 flex items-end justify-between gap-1.5" style={{ height: 80 }}>
        {[45, 62, 38, 75, 90, 100, 30].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-blue-500"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-400">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <span key={i} className="flex-1 text-center">
            {d}
          </span>
        ))}
      </div>
    </div>
  </div>
);

type Block = {
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  mockup: ReactNode;
};

const blocks: Block[] = [
  {
    eyebrow: "Punto de venta",
    title: "Vende más rápido con el POS",
    description:
      "Una pantalla simple para cobrar en segundos, pensada para el día a día de tu mostrador.",
    points: [
      "Búsqueda rápida de productos",
      "Cobros en efectivo, tarjeta y billeteras",
      "Descuentos y comprobantes al instante",
    ],
    mockup: <PosMockup />,
  },
  {
    eyebrow: "Inventario",
    title: "Controla tu inventario sin sorpresas",
    description:
      "Tu stock se actualiza solo con cada venta y compra, y te avisa cuando algo está por agotarse.",
    points: [
      "Stock en tiempo real",
      "Alertas de stock bajo",
      "Productos organizados por categoría",
    ],
    mockup: <InventoryMockup />,
  },
  {
    eyebrow: "Caja y finanzas",
    title: "Gestiona la caja y sus movimientos",
    description:
      "Abre y cierra caja por turno, registra ingresos y egresos y cuadra el dinero al final del día.",
    points: [
      "Apertura y cierre de caja",
      "Registro de movimientos",
      "Arqueo claro al cierre",
    ],
    mockup: <CashMockup />,
  },
  {
    eyebrow: "Pedidos y clientes",
    title: "Administra pedidos y clientes",
    description:
      "Lleva el estado de cada pedido y guarda el historial de tus clientes para atenderlos mejor.",
    points: [
      "Seguimiento de pedidos por estado",
      "Historial de compras por cliente",
      "Datos de contacto siempre a mano",
    ],
    mockup: <OrdersMockup />,
  },
  {
    eyebrow: "Reportes",
    title: "Consulta los reportes del negocio",
    description:
      "Mira cómo va tu negocio con resúmenes claros de ventas, productos y movimientos.",
    points: [
      "Resumen de ventas por período",
      "Productos más vendidos",
      "Visión general del negocio",
    ],
    mockup: <ReportsMockup />,
  },
];

const FeatureShowcase = () => (
  <section className="bg-white px-6 py-20 md:py-28">
    <div className="mx-auto max-w-6xl space-y-20 md:space-y-28">
      {blocks.map((block, index) => {
        const reversed = index % 2 === 1;
        return (
          <div
            key={block.title}
            className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
          >
            <div className={reversed ? "lg:order-2" : ""}>
              <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-widest text-blue-600">
                {block.eyebrow}
              </span>
              <h2 className="text-balance text-2xl font-bold text-slate-900 md:text-3xl">
                {block.title}
              </h2>
              <p className="mt-4 text-pretty text-lg leading-relaxed text-slate-600">
                {block.description}
              </p>
              <ul className="mt-6 space-y-3">
                {block.points.map((point) => (
                  <li key={point} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="text-sm text-slate-700">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={reversed ? "lg:order-1" : ""}>
              <div className="relative">
                <div className="absolute -inset-4 rounded-3xl bg-slate-50" />
                <div className="relative">{block.mockup}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </section>
);

export default FeatureShowcase;
