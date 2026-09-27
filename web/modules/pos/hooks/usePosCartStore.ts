"use client";

import { useCallback, useMemo } from "react";
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

  const setCartItemsAction = useCallback(
    (items: typeof posCart.items) => dispatch(setCartItems(items)),
    [dispatch]
  );
  const setSelectedCustomerIdAction = useCallback(
    (customerId: string | null) => dispatch(setSelectedCustomerId(customerId)),
    [dispatch]
  );
  const setPaymentsAction = useCallback(
    (payments: typeof posCart.payments) => dispatch(setPayments(payments)),
    [dispatch]
  );
  const setSaleStatusAction = useCallback(
    (status: typeof posCart.saleStatus) => dispatch(setSaleStatus(status)),
    [dispatch]
  );
  const beginSaleSubmissionAction = useCallback(
    (attempt: NonNullable<typeof posCart.saleAttempt>) => {
      dispatch(beginSaleSubmission(attempt));
      persistPosCartState(store.getState().posCart);
    },
    [dispatch]
  );
  const markSaleSubmissionUnknownAction = useCallback(() => {
    dispatch(markSaleSubmissionUnknown());
    persistPosCartState(store.getState().posCart);
  }, [dispatch]);
  const allowSaleSubmissionRetryAction = useCallback(() => {
    dispatch(allowSaleSubmissionRetry());
    persistPosCartState(store.getState().posCart);
  }, [dispatch]);
  const allowUnknownSaleRetryAction = useCallback(() => {
    dispatch(allowUnknownSaleRetry());
    persistPosCartState(store.getState().posCart);
  }, [dispatch]);
  const resetPosCartSaleAction = useCallback(
    () => dispatch(resetPosCartSale()),
    [dispatch]
  );

  return useMemo(
    () => ({
      ...posCart,
      setCartItems: setCartItemsAction,
      setSelectedCustomerId: setSelectedCustomerIdAction,
      setPayments: setPaymentsAction,
      setSaleStatus: setSaleStatusAction,
      beginSaleSubmission: beginSaleSubmissionAction,
      markSaleSubmissionUnknown: markSaleSubmissionUnknownAction,
      allowSaleSubmissionRetry: allowSaleSubmissionRetryAction,
      allowUnknownSaleRetry: allowUnknownSaleRetryAction,
      resetPosCartSale: resetPosCartSaleAction,
    }),
    [
      posCart,
      setCartItemsAction,
      setSelectedCustomerIdAction,
      setPaymentsAction,
      setSaleStatusAction,
      beginSaleSubmissionAction,
      markSaleSubmissionUnknownAction,
      allowSaleSubmissionRetryAction,
      allowUnknownSaleRetryAction,
      resetPosCartSaleAction,
    ]
  );
};


