"use client";

import { useCallback, useMemo } from "react";
import { store } from "../../../store";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import {
  addAccount,
  allowSaleSubmissionRetry,
  allowUnknownSaleRetry,
  beginSaleSubmission,
  markSaleSubmissionUnknown,
  persistPosCartState,
  removeAccount,
  renameAccount,
  resetPosCartSale,
  setCartItems,
  setPayments,
  setSaleStatus,
  setSelectedCustomerId,
  switchAccount,
  POS_SALE_STATUSES,
  POS_CART_PRICING_STATUSES,
  type PosSaleStatus,
  type PosCartPricingStatus,
} from "../../../store/posCart";

export {
  POS_SALE_STATUSES,
  POS_CART_PRICING_STATUSES,
  type PosSaleStatus,
  type PosCartPricingStatus,
};

export const usePosCartStore = () => {
  const dispatch = useAppDispatch();
  const posCart = useAppSelector((state) => state.posCart);

  const setCartItemsAction = useCallback(
    (items: typeof posCart.items) => {
      dispatch(setCartItems(items));
      persistPosCartState(store.getState().posCart);
    },
    [dispatch]
  );
  const setSelectedCustomerIdAction = useCallback(
    (customerId: string | null) => {
      dispatch(setSelectedCustomerId(customerId));
      persistPosCartState(store.getState().posCart);
    },
    [dispatch]
  );
  const setPaymentsAction = useCallback(
    (payments: typeof posCart.payments) => {
      dispatch(setPayments(payments));
      persistPosCartState(store.getState().posCart);
    },
    [dispatch]
  );
  const setSaleStatusAction = useCallback(
    (status: typeof posCart.saleStatus) => {
      dispatch(setSaleStatus(status));
      persistPosCartState(store.getState().posCart);
    },
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
  const resetPosCartSaleAction = useCallback(() => {
    dispatch(resetPosCartSale());
    persistPosCartState(store.getState().posCart);
  }, [dispatch]);

  const addAccountAction = useCallback(
    (options?: { name?: string }) => {
      dispatch(addAccount(options));
      persistPosCartState(store.getState().posCart);
    },
    [dispatch]
  );

  const switchAccountAction = useCallback(
    (accountId: string) => {
      dispatch(switchAccount(accountId));
      persistPosCartState(store.getState().posCart);
    },
    [dispatch]
  );

  const renameAccountAction = useCallback(
    (payload: { id: string; name: string }) => {
      dispatch(renameAccount(payload));
      persistPosCartState(store.getState().posCart);
    },
    [dispatch]
  );

  const removeAccountAction = useCallback(
    (accountId: string) => {
      dispatch(removeAccount(accountId));
      persistPosCartState(store.getState().posCart);
    },
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
      addAccount: addAccountAction,
      switchAccount: switchAccountAction,
      renameAccount: renameAccountAction,
      removeAccount: removeAccountAction,
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
      addAccountAction,
      switchAccountAction,
      renameAccountAction,
      removeAccountAction,
    ]
  );
};


