"use client";

import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ConfirmDialog,
  type ConfirmDialogProps,
} from "../components/design-system/confirm-dialog";

export type ConfirmOptions = Omit<
  ConfirmDialogProps,
  "open" | "onOpenChange" | "onConfirm" | "loading"
> & {
  onConfirm?: () => void | Promise<void>;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<void>;
};

type ConfirmRequest = {
  options: ConfirmOptions;
  resolve: () => void;
  reject: (error: unknown) => void;
};

export class ConfirmCancelledError extends Error {
  constructor(message = "La acción fue cancelada por el usuario.") {
    super(message);
    this.name = "ConfirmCancelledError";
  }
}

export const isConfirmCancelledError = (
  error: unknown
): error is ConfirmCancelledError =>
  error instanceof ConfirmCancelledError ||
  (error instanceof Error && error.name === "ConfirmCancelledError");

export const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [queue, setQueue] = useState<ConfirmRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const currentRequest = queue[0] ?? null;

  const closeCurrent = useCallback(() => {
    setLoading(false);
    setQueue((prev) => prev.slice(1));
  }, []);

  const handleCancel = useCallback(() => {
    if (!currentRequest || loading) {
      return;
    }

    currentRequest.reject(new ConfirmCancelledError());
    closeCurrent();
  }, [closeCurrent, currentRequest, loading]);

  const handleConfirm = useCallback(async () => {
    if (!currentRequest) {
      return;
    }

    try {
      setLoading(true);
      await currentRequest.options.onConfirm?.();
      currentRequest.resolve();
      closeCurrent();
    } catch (error) {
      currentRequest.reject(error);
      closeCurrent();
    }
  }, [closeCurrent, currentRequest]);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<void>((resolve, reject) => {
      setQueue((prev) => [...prev, { options, resolve, reject }]);
    });
  }, []);

  const contextValue = useMemo(
    () => ({
      confirm,
    }),
    [confirm]
  );

  return (
    <ConfirmContext.Provider value={contextValue}>
      {children}
      <ConfirmDialog
        open={Boolean(currentRequest)}
        onOpenChange={(open) => {
          if (!open) {
            handleCancel();
          }
        }}
        title={currentRequest?.options.title ?? ""}
        description={currentRequest?.options.description}
        confirmText={currentRequest?.options.confirmText}
        cancelText={currentRequest?.options.cancelText}
        variant={currentRequest?.options.variant}
        onConfirm={handleConfirm}
        loading={loading}
      />
    </ConfirmContext.Provider>
  );
};
