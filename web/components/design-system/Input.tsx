import {
  forwardRef,
  type InputHTMLAttributes,
} from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, className, ...props }, ref) => {
    return (
      <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
        <span className="font-medium">
          {label}
          {props.required ? <span className="text-red-600"> *</span> : null}
        </span>
        <input
          ref={ref}
          {...props}
          className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 ${className ?? ""} dark:bg-slate-800 dark:border-slate-700 dark:text-white`}
        />
        {hint ? <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span> : null}
      </label>
    );
  }
);

Input.displayName = "Input";
