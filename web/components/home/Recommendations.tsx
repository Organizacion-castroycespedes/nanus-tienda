import Link from "next/link";
import { ChevronRight, Lightbulb, type LucideIcon } from "lucide-react";

export type Recommendation = {
  key: string;
  title: string;
  href: string;
  icon: LucideIcon;
  highlight?: boolean;
};

export const Recommendations = ({
  recommendations,
}: {
  recommendations: Recommendation[];
}) => {
  return (
    <section
      aria-labelledby="recommendations-title"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-600">
          <Lightbulb className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2
            id="recommendations-title"
            className="text-lg font-semibold text-slate-900"
          >
            Siguiente acción sugerida
          </h2>
          <p className="text-sm text-slate-500">
            Recomendaciones para mantener tu operación al día.
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {recommendations.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  item.highlight
                    ? "border-amber-200 bg-amber-50 hover:border-amber-300"
                    : "border-slate-200 bg-white hover:border-blue-200"
                }`}
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                    item.highlight
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="flex-1 text-sm font-medium text-slate-800">
                  {item.title}
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-600"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
