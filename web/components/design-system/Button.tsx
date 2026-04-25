import { Loader2 } from "lucide-react";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?:
    | "primary"
    | "secondary"
    | "ghost"
    | "outline"
    | "danger"
    | "warning"
    | "disabled";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  children: ReactNode;
};

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600",
  secondary:
    "bg-slate-900 text-white shadow-sm hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-900",
  ghost:
    "bg-transparent text-slate-900 border border-slate-200 hover:bg-slate-50",
  outline:
    "bg-white text-slate-900 border border-slate-200 shadow-sm hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-300",
  danger:
    "bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-600",
  warning:
    "bg-amber-500 text-slate-950 shadow-sm hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-amber-500",
  disabled:
    "bg-transparent bg-slate-200 text-slate-400 border border-slate-200 focus-visible:ring-2 focus-visible:ring-slate-900",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "min-h-9 rounded-md px-3 py-2 text-xs",
  md: "min-h-10 rounded-lg px-4 py-2 text-sm",
  lg: "min-h-11 rounded-xl px-5 py-2.5 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      children,
      className,
      type = "button",
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 font-semibold transition duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-none ${variantStyles[variant]} ${sizeStyles[size]} ${className ?? ""}`}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
