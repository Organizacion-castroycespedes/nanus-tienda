type TabItem = {
  value: string;
  label: string;
  helper?: string;
};

type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export const Tabs = ({ items, value, onChange, className }: TabsProps) => {
  return (
    <div
      className={`inline-flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm ${className ?? ""}`}
      role="tablist"
      aria-label="Pestanas"
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`rounded-xl px-4 py-2 text-left transition ${
              active
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
            onClick={() => onChange(item.value)}
          >
            <span className="block text-sm font-semibold">{item.label}</span>
            {item.helper ? (
              <span className={`block text-xs ${active ? "text-white/75" : "text-slate-500"}`}>
                {item.helper}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};
