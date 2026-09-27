import { X } from "lucide-react";
import type { ReactNode } from "react";

type ModalProps = {
  title?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  bodyClassName?: string;
  responsive?: boolean;
  fullScreen?: boolean;
  description?: string;
  header?: ReactNode;
  footer?: ReactNode;
  footerClassName?: string;
  onClose?: () => void;
  size?: "md" | "lg" | "xl" | "full";
};

const sizeStyles: Record<NonNullable<ModalProps["size"]>, string> = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-5xl",
  full: "max-w-7xl",
};

export const Modal = ({
  title,
  children,
  className,
  contentClassName,
  bodyClassName,
  responsive = false,
  fullScreen = false,
  description,
  header,
  footer,
  footerClassName,
  onClose,
  size = "md",
}: ModalProps) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 ${
        fullScreen
          ? "!p-0 !m-0 overflow-hidden"
          : responsive
            ? "overflow-hidden p-2 sm:p-4"
            : "p-6"
      } ${fullScreen ? "cart-sale-modal-overlay" : ""}`}
    >
      {onClose ? (
        <button
          type="button"
          aria-label="Cerrar modal"
          className="absolute inset-0 h-full w-full cursor-default"
          onClick={onClose}
        />
      ) : null}
      <div
        className={`relative w-full ${
          fullScreen
            ? "!h-[100dvh] !h-screen !w-[100vw] !w-screen !max-w-none !max-h-none !rounded-none rounded-none !border-0 flex flex-col p-4 sm:p-6"
            : responsive
              ? `flex min-h-0 max-h-[calc(100dvh-1rem)] flex-col overflow-hidden p-4 sm:max-h-[calc(100dvh-2rem)] sm:p-6 ${sizeStyles[size]} rounded-2xl`
              : `p-6 ${sizeStyles[size]} rounded-2xl`
        } bg-white shadow-xl ${fullScreen ? "cart-sale-modal-content" : ""} ${className ?? ""} ${
          contentClassName ?? ""
        } dark:bg-slate-800`}
      >
        <div className={`flex items-start justify-between gap-4 ${responsive ? "shrink-0" : ""}`}>
          {header ? (
            <div className="min-w-0 flex-1">{header}</div>
          ) : (
            <div className="min-w-0">
              {title ? (
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
              ) : null}
              {description ? (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
              ) : null}
            </div>
          )}
          {onClose ? (
            <button
              type="button"
              aria-label="Cerrar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-700 shadow-2xs transition hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div
          className={`mt-4 ${
            responsive ? "min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1" : ""
          } ${bodyClassName ?? ""}`}
        >
          {children}
        </div>
        {footer ? (
          <div
            className={`${responsive ? "mt-4 shrink-0" : "mt-6"} flex justify-end gap-3 ${
              footerClassName ?? ""
            }`}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};
