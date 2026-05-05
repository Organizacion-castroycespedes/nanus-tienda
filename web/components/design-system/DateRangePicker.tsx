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
};

export const DateRangePicker = ({
  label = "Rango de fechas",
  value,
  onChange,
  fromLabel = "Desde",
  toLabel = "Hasta",
  className,
}: DateRangePickerProps) => {
  return (
    <fieldset className={`rounded-2xl border border-slate-200 bg-white p-4 ${className ?? ""}`}>
      <legend className="px-2 text-sm font-medium text-slate-700">{label}</legend>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-slate-700">
          <span className="font-medium">{fromLabel}</span>
          <input
            type="date"
            value={value.from}
            onChange={(event) =>
              onChange({
                from: event.target.value,
                to: value.to,
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-700">
          <span className="font-medium">{toLabel}</span>
          <input
            type="date"
            value={value.to}
            min={value.from || undefined}
            onChange={(event) =>
              onChange({
                from: value.from,
                to: event.target.value,
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </label>
      </div>
    </fieldset>
  );
};
