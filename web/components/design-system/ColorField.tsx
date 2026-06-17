import type { ChangeEventHandler, FocusEventHandler } from "react";
import { normalizeHexColor } from "../../src/lib/theme/colors";

type ColorFieldProps = {
  label: string;
  value: string;
  fallback: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  id?: string;
  className?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

export const ColorField = ({
  label,
  value,
  fallback,
  required = false,
  error,
  hint,
  id,
  className,
  onChange,
  onBlur,
}: ColorFieldProps) => {
  const inputId = id ?? `color-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const normalized = normalizeHexColor(value);
  const fallbackColor = normalizeHexColor(fallback) ?? "#F8FAFC";
  const swatchColor = normalized ?? fallbackColor;
  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    onChange(event.target.value);
  };
  const handleBlur: FocusEventHandler<HTMLInputElement> = () => {
    onBlur?.();
  };

  return (
    <div className={`flex flex-col gap-2 text-sm text-slate-700 ${className ?? ""}`}>
      <label className="font-medium" htmlFor={inputId}>
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      <div
        className={`flex min-h-10 items-center gap-2 rounded-lg border bg-white px-2.5 py-2 shadow-sm transition ${
          error
            ? "border-rose-300 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-100"
            : "border-slate-200 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600"
        }`}
      >
        <label
          className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-slate-200 shadow-inner"
          style={{ backgroundColor: swatchColor }}
          aria-label={`${label} selector`}
        >
          <input
            aria-label={`${label} selector`}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            type="color"
            value={swatchColor}
            onChange={handleChange}
          />
        </label>
        <input
          id={inputId}
          aria-invalid={Boolean(error)}
          className="min-w-0 flex-1 bg-transparent font-mono text-sm uppercase text-slate-900 outline-none placeholder:text-slate-400"
          inputMode="text"
          maxLength={7}
          placeholder={fallbackColor}
          value={value}
          onBlur={handleBlur}
          onChange={handleChange}
        />
      </div>
      {error ? (
        <span className="text-xs font-medium text-rose-600" role="alert">
          {error}
        </span>
      ) : (
        <span className="text-xs text-slate-500">
          {hint ?? (normalized ? normalized : `Fallback ${fallbackColor}`)}
        </span>
      )}
    </div>
  );
};
