"use client";

import { useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import {
  closeCartSheet,
  openCartSheet,
  setCartSheetOpen,
  toggleCartSheet,
} from "../../../store/posUi";

export const usePosUiStore = () => {
  const dispatch = useAppDispatch();
  const posUi = useAppSelector((state) => state.posUi);

  return useMemo(
    () => ({
      ...posUi,
      setCartSheetOpen: (open: boolean) => dispatch(setCartSheetOpen(open)),
      openCartSheet: () => dispatch(openCartSheet()),
      closeCartSheet: () => dispatch(closeCartSheet()),
      toggleCartSheet: () => dispatch(toggleCartSheet()),
    }),
    [dispatch, posUi]
  );
};
