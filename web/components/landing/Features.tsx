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
    border: "border-blue-100",
    visual: (
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-2.5 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Nueva Venta #1847</span>
            <span className="text-xs text-slate-400">14:32</span>
          </div>
        </div>
        <div className="p-2.5">
          <div className="space-y-1.5">
            {[
              { sku: "001254", name: "Arroz Costeño 1kg", qty: 2, price: "S/ 7.80" },
              { sku: "003421", name: "Aceite Primor 1L", qty: 1, price: "S/ 12.50" },
              { sku: "001089", name: "Leche Gloria 400g", qty: 3, price: "S/ 11.70" },
            ].map(({ sku, name, qty, price }) => (
              <div key={sku} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1">
                <div>
                  <p className="text-xs font-medium text-slate-700">{name}</p>
                  <p className="text-xs text-slate-400">SKU: {sku} x {qty}</p>
                </div>
                <span className="text-xs font-semibold text-slate-900">{price}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Subtotal (6 items)</span>
              <span className="text-xs font-medium text-slate-700">S/ 32.00</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">TOTAL</span>
              <span className="text-sm font-bold text-blue-600">S/ 32.00</span>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {["Efectivo", "Yape", "Tarjeta"].map((m) => (
              <button key={m} className={`rounded px-2 py-1 text-xs font-medium ${m === "Efectivo" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>{m}</button>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Control de Inventario",
    description:
      "Stock actualizado en tiempo real con cada venta y recepcion de mercancia. Alertas de stock minimo.",
    border: "border-emerald-100",
    visual: (
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-2.5 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Inventario</span>
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">8 alertas</span>
          </div>
        </div>
        <div className="p-2">
          <div className="mb-2 flex gap-1">
            <input type="text" placeholder="Buscar producto..." className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 placeholder:text-slate-400" readOnly />
          </div>
          <div className="space-y-1">
            {[
              { name: "Arroz Costeño 1kg", stock: 45, min: 20, status: "ok", code: "ALM-001" },
              { name: "Aceite Primor 1L", stock: 8, min: 15, status: "low", code: "ALM-002" },
              { name: "Azúcar Rubia 1kg", stock: 3, min: 10, status: "critical", code: "ALM-003" },
              { name: "Leche Gloria 400g", stock: 62, min: 25, status: "ok", code: "ALM-004" },
            ].map(({ name, stock, min, status, code }) => (
              <div key={code} className="flex items-center justify-between rounded border border-slate-100 bg-white px-2 py-1.5">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-700">{name}</p>
                  <p className="text-xs text-slate-400">{code} | Mín: {min}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-bold ${status === "critical" ? "text-rose-600" : status === "low" ? "text-amber-600" : "text-emerald-600"}`}>
                    {stock} un
                  </span>
                  {status !== "ok" && (
                    <p className="text-xs text-slate-400">{status === "critical" ? "Agotándose" : "Stock bajo"}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Compras y Proveedores",
    description:
      "Registra pedidos, recepciona mercancia y lleva el historial completo de tus proveedores.",
    border: "border-amber-100",
    visual: (
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-2.5 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Orden de Compra #OC-2024-089</span>
          </div>
        </div>
        <div className="p-2.5">
          <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-slate-400">Proveedor</p>
              <p className="font-medium text-slate-700">Distribuidora San Juan SAC</p>
            </div>
            <div>
              <p className="text-slate-400">Fecha entrega</p>
              <p className="font-medium text-slate-700">28 Abr 2024</p>
            </div>
          </div>
          <div className="space-y-1 rounded border border-slate-100 bg-slate-50 p-2">
            {[
              { item: "Arroz Costeño 1kg", qty: "50 un", cost: "S/ 175.00" },
              { item: "Aceite Primor 1L", qty: "24 un", cost: "S/ 264.00" },
              { item: "Azúcar Rubia 1kg", qty: "30 un", cost: "S/ 105.00" },
            ].map(({ item, qty, cost }) => (
              <div key={item} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{item}</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">{qty}</span>
                  <span className="font-medium text-slate-700">{cost}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              En tránsito
            </span>
            <span className="text-sm font-bold text-slate-900">S/ 544.00</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Gestion de Clientes",
    description:
      "CRM basico con historial de compras, datos de contacto y seguimiento de cuentas por cobrar.",
    border: "border-violet-100",
    visual: (
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-2.5 py-1.5">
          <span className="text-xs font-semibold text-slate-700">Clientes con saldo pendiente</span>
        </div>
        <div className="p-2">
          <div className="space-y-1.5">
            {[
              { name: "Juan García Mendoza", phone: "987 654 321", balance: 245.50, lastPurchase: "Hace 2 días" },
              { name: "María López Sánchez", phone: "912 345 678", balance: 120.00, lastPurchase: "Hace 5 días" },
              { name: "Carlos Ruiz Torres", phone: "956 789 012", balance: 85.80, lastPurchase: "Hoy" },
            ].map(({ name, phone, balance, lastPurchase }) => (
              <div key={name} className="rounded border border-slate-100 bg-white p-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-700">{name}</p>
                    <p className="text-xs text-slate-400">{phone}</p>
                  </div>
                  <span className="text-xs font-bold text-rose-600">S/ {balance.toFixed(2)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Última compra: {lastPurchase}</span>
                  <button className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-600">Cobrar</button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 rounded bg-rose-50 px-2 py-1.5 text-center">
            <p className="text-xs text-rose-600">Total por cobrar: <span className="font-bold">S/ 451.30</span></p>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Finanzas y Cuentas",
    description:
      "Cuentas por cobrar y pagar, pagos parciales, saldos y sobrepagos. Todo bajo control.",
    border: "border-rose-100",
    visual: (
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-2.5 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Resumen Financiero - Abril 2024</span>
          </div>
        </div>
        <div className="p-2.5">
          <div className="mb-2 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-emerald-50 p-2">
              <p className="text-xs text-emerald-600">Ingresos</p>
              <p className="text-sm font-bold text-emerald-700">S/ 12,480.50</p>
              <p className="text-xs text-emerald-500">+18% vs mes anterior</p>
            </div>
            <div className="rounded-lg bg-rose-50 p-2">
              <p className="text-xs text-rose-600">Egresos</p>
              <p className="text-sm font-bold text-rose-700">S/ 8,240.00</p>
              <p className="text-xs text-rose-500">Compras + gastos</p>
            </div>
          </div>
          <div className="rounded-lg bg-blue-50 p-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600">Utilidad Neta</p>
                <p className="text-lg font-bold text-blue-700">S/ 4,240.50</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-blue-500">Margen</p>
                <p className="text-sm font-bold text-blue-600">34%</p>
              </div>
            </div>
          </div>
          <div className="mt-2 space-y-1">
            {[
              { label: "Por cobrar (clientes)", value: "S/ 1,420.00", color: "amber" },
              { label: "Por pagar (proveedores)", value: "S/ 2,180.00", color: "rose" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{label}</span>
                <span className={`font-semibold text-${color}-600`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Reportes y Visibilidad",
    description:
      "Dashboards con ventas, ingresos y movimientos para tomar decisiones con datos reales.",
    border: "border-sky-100",
    visual: (
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-2.5 py-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Análisis de Ventas</span>
            <select className="rounded border-0 bg-transparent text-xs text-slate-500">
              <option>Últimos 7 días</option>
            </select>
          </div>
        </div>
        <div className="p-2.5">
          <div className="mb-3">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-xs text-slate-500">Total vendido</span>
              <span className="text-xs font-medium text-emerald-600">+22.4%</span>
            </div>
            <p className="text-lg font-bold text-slate-900">S/ 8,547.80</p>
          </div>
          <div className="flex items-end justify-between gap-0.5" style={{ height: 50 }}>
            {[
              { d: "Lun", h: 45, v: "980" },
              { d: "Mar", h: 62, v: "1,240" },
              { d: "Mié", h: 38, v: "820" },
              { d: "Jue", h: 75, v: "1,480" },
              { d: "Vie", h: 90, v: "1,820" },
              { d: "Sáb", h: 100, v: "2,100" },
              { d: "Dom", h: 25, v: "420" },
            ].map(({ d, h }) => (
              <div key={d} className="flex flex-1 flex-col items-center gap-0.5">
                <div className="w-full rounded-sm bg-gradient-to-t from-sky-600 to-sky-400" style={{ height: `${h}%` }} />
                <span className="text-xs text-slate-400">{d}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1 border-t border-slate-100 pt-2">
            {[
              { label: "Transacciones", value: "186" },
              { label: "Ticket prom.", value: "S/ 46" },
              { label: "Top producto", value: "Arroz" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-xs font-semibold text-slate-700">{value}</p>
                <p className="text-xs text-slate-400">{label}</p>
              </div>
            ))}
          </div>
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
        {features.map(({ title, description, border, visual }) => (
          <article
            key={title}
            className={`group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${border}`}
          >
            <div className="mb-4">
              {visual}
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
