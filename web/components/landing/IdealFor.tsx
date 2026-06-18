import { Store, ShoppingBag, Building2, Boxes } from "lucide-react";

const audiences = [
  {
    icon: Store,
    title: "Tiendas",
    description:
      "Tiendas de barrio que quieren vender ordenado y controlar su stock.",
  },
  {
    icon: ShoppingBag,
    title: "Minimarkets",
    description:
      "Minimarkets con alto flujo de ventas que necesitan rapidez en caja.",
  },
  {
    icon: Building2,
    title: "Retail pequeño",
    description:
      "Negocios retail que buscan profesionalizar su operación diaria.",
  },
  {
    icon: Boxes,
    title: "Comercios operativos",
    description:
      "Comercios que necesitan control de inventario, caja y pedidos.",
  },
];

const IdealFor = () => (
  <section className="bg-slate-50 px-6 py-20 md:py-28">
    <div className="mx-auto max-w-6xl">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-widest text-blue-600">
          Ideal para
        </span>
        <h2 className="text-balance text-3xl font-bold text-slate-900 md:text-4xl">
          Hecho para negocios como el tuyo
        </h2>
        <p className="mt-4 text-pretty text-lg text-slate-600">
          Manus POS se adapta a distintos tipos de comercio que necesitan
          control operativo real.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {audiences.map(({ icon: Icon, title, description }) => (
          <article
            key={title}
            className="flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
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

export default IdealFor;
