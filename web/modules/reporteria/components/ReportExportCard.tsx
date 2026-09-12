import { FileSpreadsheet } from "lucide-react";
import { Button } from "../../../components/design-system/Button";

type ReportExportAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

type ReportExportCardProps = {
  title: string;
  description: string;
  helper?: string;
  actions: ReportExportAction[];
};

export const ReportExportCard = ({
  title,
  description,
  helper,
  actions,
}: ReportExportCardProps) => (
  <section className="rounded-[28px] border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        <div className="inline-flex rounded-2xl bg-emerald-600 p-3 text-white shadow-sm">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
          Conciliacion
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        {helper ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{helper}</p> : null}
      </div>
      <div className="flex flex-wrap gap-3">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="secondary"
            onClick={action.onClick}
            disabled={action.disabled}
          >
            <FileSpreadsheet className="h-4 w-4" />
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  </section>
);
