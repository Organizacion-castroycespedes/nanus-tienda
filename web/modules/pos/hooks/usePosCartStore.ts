"use client";

import { useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import {
  resetPosCartSale,
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
      resetPosCartSale: () => dispatch(resetPosCartSale()),
    }),
    [dispatch, posCart]
  );
};
