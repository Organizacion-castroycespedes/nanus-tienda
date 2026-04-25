"use client";

import { useContext } from "react";
import {
  ConfirmContext,
  ConfirmCancelledError,
  isConfirmCancelledError,
  type ConfirmOptions,
} from "../providers/confirm-provider";

type ConfirmFn = (options: ConfirmOptions) => Promise<void>;

export const useConfirm = (): ConfirmFn => {
  const context = useContext(ConfirmContext);

  if (!context) {
    throw new Error("useConfirm debe usarse dentro de ConfirmProvider.");
  }

  return context.confirm;
};

export { ConfirmCancelledError, isConfirmCancelledError };
export type { ConfirmOptions };
