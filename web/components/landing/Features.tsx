import {
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  Settings2,
  ShoppingCart,
  Tag,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";

const features = [
  {
    icon: ShoppingCart,
    title: "Punto de venta (POS)",
    description:
      "Registra ventas en segundos, aplica descuentos y cobra con efectivo, tarjeta o billeteras.",
    benefit: "Atiende más rápido y sin filas.",
  },
  {
    icon: Boxes,
    title: "Inventario",
    description:
      "Stock actualizado con cada venta y recepción, con alertas de productos por agotarse.",
    benefit: "Nunca te quedes sin lo que más vendes.",
  },
  {
    icon: CreditCard,
    title: "Caja",
    description:
      "Apertura y cierre de caja, control de movimientos y arqueo al final del turno.",
    benefit: "Cuadra tu dinero sin dolores de cabeza.",
  },
  {
    icon: ClipboardList,
    title: "Pedidos",
    description:
      "Crea y administra pedidos, da seguimiento a su estado y conviértelos en ventas.",
    benefit: "Lleva el control de cada encargo.",
  },
  {
    icon: Truck,
    title: "Compras y recepción",
    description:
      "Genera órdenes de compra y registra la mercancía recibida actualizando el stock.",
    benefit: "Repón mercadería con orden.",
  },
  {
    icon: Users,
    title: "Clientes",
    description:
      "Guarda los datos de tus clientes y su historial para darles una mejor atención.",
    benefit: "Conoce y fideliza a tus compradores.",
  },
  {
    icon: Warehouse,
    title: "Proveedores",
    description:
      "Centraliza la información de tus proveedores y el historial de tus compras.",
    benefit: "Negocia mejor con tus datos a la mano.",
  },
  {
    icon: BarChart3,
    title: "Reportes",
    description:
      "Consulta ventas, productos top y movimientos del negocio en resúmenes claros.",
    benefit: "Decide con información real.",
  },
  {
    icon: Tag,
    title: "Promociones",
    description:
      "Crea descuentos y promociones para impulsar las ventas en fechas clave.",
    benefit: "Vende más en los momentos correctos.",
  },
  {
    icon: Settings2,
    title: "Configuración",
    description:
      "Define tu negocio, impuestos, usuarios y roles desde un panel multinegocio.",
    benefit: "Adapta Manus a tu operación.",
  },
];

const Features = () => (
  <section id="funcionalidades" className="bg-slate-50 px-6 py-20 md:py-28">
    <div className="mx-auto max-w-6xl">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-widest text-blue-600">
          Funcionalidades
        </span>
        <h2 className="text-balance text-3xl font-bold text-slate-900 md:text-4xl">
          Todo lo que tu negocio necesita, en un solo sistema
        </h2>
        <p className="mt-4 text-pretty text-lg text-slate-600">
          Cada módulo trabaja conectado con los demás para que la operación de
          tu tienda fluya sin esfuerzo.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, description, benefit }) => (
          <article
            key={title}
            className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
          >
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="mb-2 text-base font-semibold text-slate-900">
              {title}
            </h3>
            <p className="text-sm leading-relaxed text-slate-600">
              {description}
            </p>
            <p className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-sm font-medium text-blue-700">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              {benefit}
            </p>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
