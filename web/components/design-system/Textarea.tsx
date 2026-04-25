import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
};

export const Textarea = ({ label, hint, className, ...props }: TextareaProps) => {
  return (
    <label className="flex flex-col gap-2 text-sm text-slate-700">
      <span className="font-medium">{label}</span>
      <textarea
        {...props}
        className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 ${className ?? ""}`}
      />
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
};
