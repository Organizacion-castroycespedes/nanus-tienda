type FinanceAccessNoticeProps = {
  title?: string;
  description: string;
};

export const FinanceAccessNotice = ({
  title = "Acceso restringido",
  description,
}: FinanceAccessNoticeProps) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    <p className="mt-2 text-sm text-slate-600">{description}</p>
  </section>
);
