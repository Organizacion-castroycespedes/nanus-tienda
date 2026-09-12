import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
};

export const Textarea = ({ label, hint, className, ...props }: TextareaProps) => {
  return (
    <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
      <span className="font-medium">{label}</span>
      <textarea
        {...props}
        className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 ${className ?? ""} dark:bg-slate-800 dark:border-slate-700 dark:text-white`}
      />
      {hint ? <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span> : null}
    </label>
  );
};
