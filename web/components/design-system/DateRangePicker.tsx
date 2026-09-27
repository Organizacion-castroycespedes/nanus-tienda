type DateRangeValue = {
  from: string;
  to: string;
};

type DateRangePickerProps = {
  label?: string;
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  fromLabel?: string;
  toLabel?: string;
  className?: string;
  compact?: boolean;
};

const getBounds = () => {
  const now = new Date();
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map(({ type, value }) => [type, value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const [year, month, day] = today.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 4, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return { min: target.toISOString().slice(0, 10), max: today };
};

export const DateRangePicker = ({
  label = "Rango de fechas",
  value,
  onChange,
  fromLabel = "Desde",
  toLabel = "Hasta",
  className,
  compact = false,
}: DateRangePickerProps) => {
  const bounds = getBounds();
  const invalid = (value.from && value.from < bounds.min) || (value.to && value.to > bounds.max) || Boolean(value.from && value.to && value.from > value.to);
  return (
    <fieldset className={`rounded-xl border border-slate-200 bg-white ${compact ? "p-2" : "p-4"} ${className ?? ""} dark:bg-slate-800 dark:border-slate-700`}>
      <legend className="px-2 text-sm font-medium text-slate-700 dark:text-slate-200">{label}</legend>
      <div className={`grid ${compact ? "gap-2" : "gap-4"} md:grid-cols-2`}>
        <label className={`flex flex-col ${compact ? "gap-1" : "gap-2"} text-sm text-slate-700 dark:text-slate-200`}>
          <span className="font-medium">{fromLabel}</span>
          <input
            type="date"
            value={value.from}
            min={bounds.min}
            max={bounds.max}
            onChange={(event) =>
              onChange({
                from: event.target.value,
                to: value.to,
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
        </label>
        <label className={`flex flex-col ${compact ? "gap-1" : "gap-2"} text-sm text-slate-700 dark:text-slate-200`}>
          <span className="font-medium">{toLabel}</span>
          <input
            type="date"
            value={value.to}
            min={value.from || undefined}
            max={bounds.max}
            onChange={(event) =>
              onChange({
                from: value.from,
                to: event.target.value,
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
        </label>
      </div>
      {invalid ? <p role="alert" className="mt-2 text-sm text-red-700">Solo puedes consultar información de los últimos 3 meses. Modifica las fechas seleccionadas para continuar</p> : null}
    </fieldset>
  );
};
