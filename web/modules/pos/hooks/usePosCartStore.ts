"use client";

import { useMemo } from "react";
import { store } from "../../../store";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import {
  resetPosCartSale,
  allowSaleSubmissionRetry,
  allowUnknownSaleRetry,
  beginSaleSubmission,
  markSaleSubmissionUnknown,
  persistPosCartState,
  setCartItems,
  setPayments,
  setSaleStatus,
  setSelectedCustomerId,
} from "../../../store/posCart";

export const usePosCartStore = () => {
  const dispatch = useAppDispatch();
  const posCart = useAppSelector((state) => state.posCart);

  return useMemo(
    () => ({
      ...posCart,
      setCartItems: (items: typeof posCart.items) => dispatch(setCartItems(items)),
      setSelectedCustomerId: (customerId: string | null) =>
        dispatch(setSelectedCustomerId(customerId)),
      setPayments: (payments: typeof posCart.payments) => dispatch(setPayments(payments)),
      setSaleStatus: (status: typeof posCart.saleStatus) => dispatch(setSaleStatus(status)),
      beginSaleSubmission: (attempt: NonNullable<typeof posCart.saleAttempt>) => {
        dispatch(beginSaleSubmission(attempt));
        persistPosCartState(store.getState().posCart);
      },
      markSaleSubmissionUnknown: () => {
        dispatch(markSaleSubmissionUnknown());
        persistPosCartState(store.getState().posCart);
      },
      allowSaleSubmissionRetry: () => {
        dispatch(allowSaleSubmissionRetry());
        persistPosCartState(store.getState().posCart);
      },
      allowUnknownSaleRetry: () => {
        dispatch(allowUnknownSaleRetry());
        persistPosCartState(store.getState().posCart);
      },
      resetPosCartSale: () => dispatch(resetPosCartSale()),
    }),
    [dispatch, posCart]
  );
};

