import Image from "next/image";

const benefits = [
  {
    title: "Más control",
    description:
      "Ventas, caja, inventario y pedidos se ven desde un mismo lugar. Menos preguntas. Más claridad.",
    imageSrc: "/images/benefits/mas-control.png",
    imageAlt:
      "Operación de tienda centralizada con ventas, caja, inventario y pedidos conectados",
  },
  {
    title: "Menos errores",
    description:
      "El sistema calcula totales, descuenta stock y deja trazabilidad de movimientos importantes.",
    imageSrc: "/images/benefits/menos-errores.png",
    imageAlt: "Sistema POS moderno reduciendo errores operativos en mostrador",
  },
  {
    title: "Operación más rápida",
    description:
      "Los flujos están pensados para mostrador: buscar, cobrar, registrar y seguir atendiendo.",
    imageSrc: "/images/benefits/operacion-rapida.png",
    imageAlt: "Atención rápida en punto de venta para tienda o minimarket",
  },
  {
    title: "Información en tiempo real",
    description:
      "Cada venta, compra o movimiento alimenta reportes y estados operativos al instante.",
    imageSrc: "/images/benefits/informacion-tiempo-real.png",
    imageAlt: "Reportes e indicadores de negocio actualizados en tiempo real",
  },
  {
    title: "Acceso desde cualquier lugar",
    description:
      "Manus POS opera desde la web para consultar el negocio cuando lo necesites.",
    imageSrc: "/images/benefits/acceso-cualquier-lugar.png",
    imageAlt: "Acceso web a Manus POS desde distintos dispositivos",
  },
];

const Benefits = () => (
  <section id="beneficios" className="bg-white px-6 py-20 md:py-28">
    <div className="mx-auto max-w-6xl">
      <div className="mb-12 max-w-3xl">
        <span className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
          Beneficios
        </span>
        <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
          Menos caos operativo. Más control para decidir.
        </h2>
        <p className="mt-4 text-pretty text-lg leading-8 text-slate-600 dark:text-slate-300">
          Manus POS no solo registra ventas. Ordena la operación completa para
          que el negocio avance con información confiable.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
        {benefits.map(({ title, description, imageSrc, imageAlt }) => (
          <article
            key={title}
            className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl dark:bg-slate-800 dark:border-slate-700"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
              <Image
                src={imageSrc}
                alt={imageAlt}
                fill
                sizes="(min-width: 1024px) 20vw, (min-width: 768px) 50vw, 100vw"
                className="object-cover transition duration-500 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-slate-950/25 to-transparent" />
            </div>

            <div className="p-5">
              <h3 className="text-base font-bold text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {description}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default Benefits;
