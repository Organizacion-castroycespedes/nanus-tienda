"use client";

import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "success" | "danger" | "warning";
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  hideCancel?: boolean;
}

const variantStyles = {
  default: {
    badge: "border border-blue-100 bg-blue-50 text-blue-700",
    icon: <ShieldAlert className="h-5 w-5" aria-hidden="true" />,
    confirmVariant: "primary" as const,
  },
  success: {
    badge: "border border-emerald-100 bg-emerald-50 text-emerald-700",
    icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" />,
    confirmVariant: "primary" as const,
  },
  danger: {
    badge: "border border-rose-100 bg-rose-50 text-rose-700",
    icon: <AlertTriangle className="h-5 w-5" aria-hidden="true" />,
    confirmVariant: "danger" as const,
  },
  warning: {
    badge: "border border-amber-100 bg-amber-50 text-amber-700",
    icon: <AlertTriangle className="h-5 w-5" aria-hidden="true" />,
    confirmVariant: "warning" as const,
  },
};

export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "default",
  onConfirm,
  loading = false,
  hideCancel = false,
}: ConfirmDialogProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const timeout = window.setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      document.body.style.overflow = "";
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const config = variantStyles[variant];
  const dialogRole = variant === "default" ? "dialog" : "alertdialog";

  const handleBackdropClose = () => {
    if (loading) {
      return;
    }
    onOpenChange(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !loading) {
      event.preventDefault();
      onOpenChange(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-4 sm:items-center"
      onClick={handleBackdropClose}
    >
      <div
        role={dialogRole}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${config.badge}`}
          >
            {config.icon}
          </div>
          <div className="space-y-2">
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                className="whitespace-pre-line break-words text-sm leading-6 text-slate-600"
              >
                {description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {hideCancel ? null : (
            <Button
              ref={cancelButtonRef}
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {cancelText}
            </Button>
          )}
          <Button
            variant={config.confirmVariant}
            onClick={() => void onConfirm()}
            isLoading={loading}
          >
            {loading ? "Procesando..." : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
