import Image from "next/image";

const audiences = [
  {
    title: "Tiendas de barrio",
    description:
      "Vende rápido, identifica qué productos se mueven y controla caja sin perder el ritmo del mostrador.",
    imageSrc: "/images/audience/tiendas-barrio.png",
    imageAlt: "Tienda de barrio moderna usando Manus POS",
    highlight: "Mostrador ágil",
  },
  {
    title: "Minimarkets",
    description:
      "Opera con alto flujo de productos, compras frecuentes, turnos de caja y reposición constante.",
    imageSrc: "/images/audience/minimarkets.png",
    imageAlt: "Minimarket con análisis de datos y operación conectada",
    highlight: "Alto movimiento",
  },
  {
    title: "Retail pequeño",
    description:
      "Profesionaliza usuarios, roles, reportes y procesos para crecer con una operación más ordenada.",
    imageSrc: "/images/audience/retail-pequeno.png",
    imageAlt: "Tienda retail pequeña con paneles digitales",
    highlight: "Procesos claros",
  },
  {
    title: "Negocios con inventario",
    description:
      "Controla stock, pedidos, compras y proveedores con información confiable para decidir a tiempo.",
    imageSrc: "/images/audience/negocios-inventario.png",
    imageAlt: "Gestión de inventario en almacén conectado",
    highlight: "Stock bajo control",
  },
];

const IdealFor = () => (
  <section className="bg-slate-50 px-6 py-20 md:py-28">
    <div className="mx-auto max-w-6xl">
      <div className="mb-12 max-w-3xl">
        <span className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
          Para quién sirve
        </span>
        <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
          Hecho para negocios que viven de operar bien todos los días
        </h2>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {audiences.map(({ title, description, imageSrc, imageAlt, highlight }) => (
          <article
            key={title}
            className="group flex h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl dark:bg-slate-800 dark:border-slate-700"
          >
            <div className="flex min-h-full w-full flex-col">
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                <Image
                  src={imageSrc}
                  alt={imageAlt}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/45 to-transparent" />
                <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white">
                  {highlight}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-bold text-slate-950">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {description}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default IdealFor;
