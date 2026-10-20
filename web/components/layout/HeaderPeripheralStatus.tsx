import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type HeaderPeripheralTone = "ok" | "warning" | "error" | "idle";

export type HeaderPeripheralStatusProps = {
  label: string;
  Icon: LucideIcon;
  status: string;
  tone: HeaderPeripheralTone;
  detail?: string;
  pulse?: boolean;
};

const toneStyles: Record<HeaderPeripheralTone, { icon: string; dot: string }> = {
  ok: {
    icon: "text-slate-700 dark:text-slate-200",
    dot: "bg-emerald-500",
  },
  warning: {
    icon: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-400",
  },
  error: {
    icon: "text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  idle: {
    icon: "text-slate-400 dark:text-slate-500",
    dot: "bg-slate-300 dark:bg-slate-600",
  },
};

export const HeaderPeripheralStatusGroup = ({ children }: { children: ReactNode }) => (
  <div
    className="hidden items-stretch divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white/80 shadow-sm lg:flex dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-900/80"
    role="group"
    aria-label="Estado de periféricos POS"
  >
    {children}
  </div>
);

export const HeaderPeripheralStatus = ({
  label,
  Icon,
  status,
  tone,
  detail,
  pulse = false,
}: HeaderPeripheralStatusProps) => {
  const styles = toneStyles[tone];
  const description = detail ? `${label}: ${status} · ${detail}` : `${label}: ${status}`;

  return (
    <span
      className="inline-flex h-8 w-10 shrink-0 items-center justify-center"
      title={description}
      aria-label={description}
      role="status"
    >
      <span className="relative inline-flex shrink-0">
        <Icon
          className={`h-4 w-4 ${styles.icon} ${pulse ? "animate-pulse" : ""}`}
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <span
          className={`absolute -right-1.5 -top-1 h-2 w-2 rounded-full ring-2 ring-white dark:ring-slate-900 ${styles.dot}`}
          aria-hidden="true"
        />
      </span>
    </span>
  );
};
