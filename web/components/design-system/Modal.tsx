import { X } from "lucide-react";
import type { ReactNode } from "react";

type ModalProps = {
  title: string;
  children: ReactNode;
  className?: string;
  description?: string;
  footer?: ReactNode;
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
  description,
  footer,
  onClose,
  size = "md",
}: ModalProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6">
      {onClose ? (
        <button
          type="button"
          aria-label="Cerrar modal"
          className="absolute inset-0 h-full w-full cursor-default"
          onClick={onClose}
        />
      ) : null}
      <div
        className={`relative w-full ${sizeStyles[size]} rounded-2xl bg-white p-6 shadow-xl ${className ?? ""}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            {description ? (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          {onClose ? (
            <button
              type="button"
              aria-label="Cerrar"
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="mt-4">{children}</div>
        {footer ? <div className="mt-6 flex justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
};
