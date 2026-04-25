import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export const Input = ({ label, hint, className, ...props }: InputProps) => {
  return (
    <label className="flex flex-col gap-2 text-sm text-slate-700">
      <span className="font-medium">
        {label}
        {props.required ? <span className="text-red-600"> *</span> : null}
      </span>
      <input
        {...props}
        className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 ${className ?? ""}`}
      />
      {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
};
