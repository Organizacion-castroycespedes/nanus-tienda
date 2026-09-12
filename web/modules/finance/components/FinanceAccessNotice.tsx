type FinanceAccessNoticeProps = {
  title?: string;
  description: string;
};

export const FinanceAccessNotice = ({
  title = "Acceso restringido",
  description,
}: FinanceAccessNoticeProps) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
  </section>
);
