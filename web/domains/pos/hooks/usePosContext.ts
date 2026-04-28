"use client";

import { useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import {
  clearContext,
  setContext,
  setError,
  setLoading,
  setSession,
} from "../../../store/pos";

export const usePosContext = () => {
  const dispatch = useAppDispatch();
  const pos = useAppSelector((state) => state.pos);
  const applyContext = useCallback(
    (payload: {
      tenantId?: string | null;
      branchId?: string | null;
      terminalId?: string | null;
    }) => dispatch(setContext(payload)),
    [dispatch]
  );
  const applySession = useCallback(
    (payload: {
      posSessionId: string | null;
      branchId?: string | null;
      terminalId?: string | null;
    }) => dispatch(setSession(payload)),
    [dispatch]
  );
  const resetContext = useCallback(() => dispatch(clearContext()), [dispatch]);
  const applyLoading = useCallback((loading: boolean) => dispatch(setLoading(loading)), [dispatch]);
  const applyError = useCallback((error: string | null) => dispatch(setError(error)), [dispatch]);

  return useMemo(
    () => ({
      ...pos,
      isReady: Boolean(pos.posSessionId),
      setContext: applyContext,
      setSession: applySession,
      clearContext: resetContext,
      setLoading: applyLoading,
      setError: applyError,
    }),
    [applyContext, applyError, applyLoading, applySession, pos, resetContext]
  );
};
