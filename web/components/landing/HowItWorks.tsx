import Image from "next/image";

const flowImage = {
  src: "/images/home/flows/flujo-operacion-pos.png",
  alt: "Flujo operativo de Manus POS desde producto en estantería hasta reporte de ventas",
  width: 1672,
  height: 941,
};

const HowItWorks = () => (
  <section
    id="como-funciona"
    className="overflow-hidden bg-slate-950 px-6 py-20 text-white md:py-28"
  >
    <div className="mx-auto max-w-6xl">
      <div className="mb-12 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
        <div>
          <span className="text-sm font-bold uppercase tracking-[0.2em] text-blue-300">
            Cómo funciona
          </span>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight md:text-4xl">
            Del producto en estantería al reporte de ventas
          </h2>
        </div>
        <p className="text-pretty text-lg leading-8 text-slate-300">
          El flujo de Manus POS acompaña la operación completa del negocio:
          configurar, vender, controlar y consultar.
        </p>
      </div>

      <div className="-mx-6 overflow-x-auto px-6 pb-2 sm:mx-0 sm:px-0">
        <div className="mx-auto min-w-[760px] max-w-6xl rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-[0_24px_90px_rgba(37,99,235,0.25)] sm:min-w-0 sm:p-3">
          <Image
            src={flowImage.src}
            alt={flowImage.alt}
            width={flowImage.width}
            height={flowImage.height}
            sizes="(min-width: 1024px) 1100px, 760px"
            className="h-auto w-full rounded-xl object-contain"
            priority={false}
          />
        </div>
      </div>
    </div>
  </section>
);

export default HowItWorks;
