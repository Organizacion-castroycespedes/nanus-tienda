"use client";

import { useCallback, useMemo } from "react";
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

  const setCartSheetOpenAction = useCallback(
    (open: boolean) => dispatch(setCartSheetOpen(open)),
    [dispatch]
  );
  const openCartSheetAction = useCallback(
    () => dispatch(openCartSheet()),
    [dispatch]
  );
  const closeCartSheetAction = useCallback(
    () => dispatch(closeCartSheet()),
    [dispatch]
  );
  const toggleCartSheetAction = useCallback(
    () => dispatch(toggleCartSheet()),
    [dispatch]
  );

  return useMemo(
    () => ({
      ...posUi,
      setCartSheetOpen: setCartSheetOpenAction,
      openCartSheet: openCartSheetAction,
      closeCartSheet: closeCartSheetAction,
      toggleCartSheet: toggleCartSheetAction,
    }),
    [
      posUi,
      setCartSheetOpenAction,
      openCartSheetAction,
      closeCartSheetAction,
      toggleCartSheetAction,
    ]
  );
};

