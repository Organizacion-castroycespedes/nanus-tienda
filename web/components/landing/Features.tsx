import Image from "next/image";

const features = [
  {
    title: "Punto de venta",
    description:
      "Cobra rápido en mostrador, busca productos, calcula totales y registra la venta sin fricción.",
    highlight: "Ventas ágiles en horas pico.",
    imageSrc: "/images/features/punto_ventas.png",
    imageAlt: "Interfaz comercial del punto de venta de Manus POS",
    accent: "bg-blue-50 text-blue-700 border-blue-100",
  },
  {
    title: "Inventario",
    description:
      "Mantén stock, lotes, ubicaciones y alertas operativas conectadas con ventas y compras.",
    highlight: "Stock claro antes de comprar.",
    imageSrc: "/images/features/inventario.png",
    imageAlt: "Vista de inventario de Manus POS",
    accent: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  {
    title: "Caja y finanzas",
    description:
      "Abre turnos, registra movimientos, controla pagos y cierra caja con trazabilidad.",
    highlight: "Dinero bajo control.",
    imageSrc: "/images/features/caja-finanzas.png",
    imageAlt: "Control de caja y finanzas operativas de Manus POS",
    accent: "bg-amber-50 text-amber-700 border-amber-100",
  },
  {
    title: "Pedidos",
    description:
      "Crea pedidos, confirma entregas, factura cantidades listas y evita perder solicitudes.",
    highlight: "Cada encargo tiene estado.",
    imageSrc: "/images/features/pedidos.png",
    imageAlt: "Gestión de pedidos de Manus POS",
    accent: "bg-cyan-50 text-cyan-700 border-cyan-100",
  },
  {
    title: "Compras",
    description:
      "Registra compras, recepciones parciales o totales y pagos a proveedores.",
    highlight: "Reposición ordenada.",
    imageSrc: "/images/features/compras.png",
    imageAlt: "Modulo de compras de Manus POS",
    accent: "bg-orange-50 text-orange-700 border-orange-100",
  },
  {
    title: "Clientes",
    description:
      "Guarda datos de clientes, consumidor final y datos fiscales mock para operar mejor.",
    highlight: "Atención más personal.",
    imageSrc: "/images/features/clientes.png",
    imageAlt: "Gestión de clientes de Manus POS",
    accent: "bg-rose-50 text-rose-700 border-rose-100",
  },
  {
    title: "Reportes",
    description:
      "Consulta ventas, compras, caja, pedidos y tickets PDF para entender el negocio.",
    highlight: "Decisiones con datos.",
    imageSrc: "/images/features/reportes.png",
    imageAlt: "Reportes operativos de Manus POS",
    accent: "bg-indigo-50 text-indigo-700 border-indigo-100",
  },
  {
    title: "Configuración",
    description:
      "Administra usuarios, roles, menú, branding, terminales y parámetros del negocio.",
    highlight: "Sistema listo para crecer.",
    imageSrc: "/images/features/configuracion.png",
    imageAlt: "Configuracion administrativa de Manus POS",
    accent: "bg-slate-100 text-slate-700 border-slate-200",
  },
];

const Features = () => (
  <section id="funcionalidades" className="bg-slate-50 px-6 py-20 md:py-28">
    <div className="mx-auto max-w-6xl">
      <div className="mb-12 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
        <div>
          <span className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
            Funcionalidades principales
          </span>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
            Todo lo que necesita una tienda para vender y operar mejor
          </h2>
        </div>
        <p className="text-pretty text-lg leading-8 text-slate-600">
          Manus POS conecta mostrador, inventario, caja, pedidos y reportes para
          que el negocio deje de operar a ciegas. Cada módulo ayuda a reducir
          errores y ahorrar tiempo en el día a día.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(
          ({ title, description, highlight, imageSrc, imageAlt, accent }) => (
            <article
              key={title}
              className="group flex h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl"
            >
              <div className="flex min-h-full w-full flex-col">
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                  <Image
                    src={imageSrc}
                    alt={imageAlt}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/25 to-transparent" />
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-lg font-bold text-slate-950">{title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">
                    {description}
                  </p>
                  <p
                    className={`mt-5 inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-bold ${accent}`}
                  >
                    {highlight}
                  </p>
                </div>
              </div>
            </article>
          ),
        )}
      </div>
    </div>
  </section>
);

export default Features;
