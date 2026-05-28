"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { Button } from "./Button";

export type NoticeDialogVariant = "error" | "warning" | "success" | "info";

type NoticeDialogProps = {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
  variant?: NoticeDialogVariant;
  closeText?: string;
  confirmText?: string;
  confirming?: boolean;
  children?: ReactNode;
};

const variantConfig: Record<
  NoticeDialogVariant,
  {
    icon: ReactNode;
    tone: string;
    buttonVariant: "primary" | "danger" | "warning";
  }
> = {
  error: {
    icon: <XCircle className="h-5 w-5" aria-hidden="true" />,
    tone: "border-rose-100 bg-rose-50 text-rose-700",
    buttonVariant: "danger",
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5" aria-hidden="true" />,
    tone: "border-amber-100 bg-amber-50 text-amber-700",
    buttonVariant: "warning",
  },
  success: {
    icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" />,
    tone: "border-emerald-100 bg-emerald-50 text-emerald-700",
    buttonVariant: "primary",
  },
  info: {
    icon: <Info className="h-5 w-5" aria-hidden="true" />,
    tone: "border-blue-100 bg-blue-50 text-blue-700",
    buttonVariant: "primary",
  },
};

export const NoticeDialog = ({
  open,
  title,
  message,
  onClose,
  onConfirm,
  variant = "info",
  closeText = "Entendido",
  confirmText = "Confirmar",
  confirming = false,
  children,
}: NoticeDialogProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const timeout = window.setTimeout(() => {
      closeButtonRef.current?.focus();
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

  const config = variantConfig[variant];

  const closeIfAllowed = () => {
    if (!confirming) {
      onClose();
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !confirming) {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeIfAllowed();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${config.tone}`}
          >
            {config.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            <p
              id={descriptionId}
              className="mt-2 whitespace-normal break-words text-sm leading-6 text-slate-600"
            >
              {message}
            </p>
          </div>
        </div>

        {children ? <div className="mt-4 min-w-0 break-words">{children}</div> : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            ref={closeButtonRef}
            variant={onConfirm ? "ghost" : config.buttonVariant}
            onClick={onClose}
            disabled={confirming}
          >
            {closeText}
          </Button>
          {onConfirm ? (
            <Button
              variant={config.buttonVariant}
              onClick={onConfirm}
              disabled={confirming}
              isLoading={confirming}
            >
              {confirming ? "Procesando..." : confirmText}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
