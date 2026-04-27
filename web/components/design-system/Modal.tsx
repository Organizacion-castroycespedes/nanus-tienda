import type { ReactNode } from "react";

type ModalProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export const Modal = ({ title, children, className }: ModalProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6 dark:bg-slate-950/60">
      <div
        className={`w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-950 ${className ?? ""}`}
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};
