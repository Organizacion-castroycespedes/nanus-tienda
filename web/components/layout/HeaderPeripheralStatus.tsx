import type { LucideIcon } from "lucide-react";

export type HeaderPeripheralStatusProps = {
  label: string;
  Icon: LucideIcon;
  status: string;
  tone: string;
};

export const HeaderPeripheralStatus = ({
  label,
  Icon,
  status,
  tone,
}: HeaderPeripheralStatusProps) => (
  <span
    className="group inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-[var(--brand-header-text)] xl:h-9 xl:w-auto xl:min-w-[4.25rem] xl:gap-1.5 xl:px-2 dark:border-slate-700 dark:bg-slate-900/80"
    title={`${label}: ${status}`}
    aria-label={`${label}: ${status}`}
  >
    <span className="relative inline-flex shrink-0">
      <Icon className={`h-4 w-4 ${tone}`} aria-hidden="true" />
      <span
        className={`absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-current ${tone}`}
        aria-hidden="true"
      />
    </span>
    <span className="hidden text-[9px] font-semibold leading-tight xl:inline">
      <span className="block text-[var(--brand-header-text)]">{label}</span>
      <span className={`block ${tone}`}>{status}</span>
    </span>
  </span>
);
