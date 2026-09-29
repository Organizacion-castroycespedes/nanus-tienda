"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  closeCashSession,
  getCashSessionSummary,
  getCurrentCashSession,
  listCashSessionHistory,
  openCashSession,
} from "../services/finance.service";
import type {
  CashSession,
  CashSessionHistoryFilters,
  CashSessionSummary,
  CloseCashSessionPayload,
  OpenCashSessionPayload,
} from "../types";
import { getApiErrorMessage } from "../../reporteria/utils";

export const useCashSessions = () => {
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [availableOpenSessions, setAvailableOpenSessions] = useState<CashSession[]>([]);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [sessionSummary, setSessionSummary] = useState<CashSessionSummary | null>(null);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const openSessionsRequestId = useRef(0);

  useEffect(() => {
    return () => {
      openSessionsRequestId.current += 1;
    };
  }, []);

  const loadCurrentSession = useCallback(async (cashRegisterId?: string) => {
    setLoadingCurrent(true);
    setErrorMessage(null);
    try {
      const session = await getCurrentCashSession(cashRegisterId);
      setCurrentSession(session);
      return session;
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "No se pudo consultar la caja actual."));
      return null;
    } finally {
      setLoadingCurrent(false);
    }
  }, []);

  const loadSessionSummary = useCallback(async (cashSessionId: string) => {
    setLoadingSummary(true);
    setErrorMessage(null);
    try {
      const summary = await getCashSessionSummary(cashSessionId);
      setSessionSummary(summary);
      return summary;
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "No se pudo cargar el resumen de la caja.")
      );
      return null;
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const loadHistory = useCallback(async (filters: CashSessionHistoryFilters = {}) => {
    const isOpenRequest = filters.status === "OPEN";
    const requestId = isOpenRequest ? ++openSessionsRequestId.current : 0;
    setLoadingHistory(true);
    setErrorMessage(null);
    try {
      const items = await listCashSessionHistory(filters);
      if (isOpenRequest && requestId !== openSessionsRequestId.current) {
        return [];
      }
      setHistory(items);
      if (isOpenRequest) {
        setAvailableOpenSessions(items);
      }
      setHistoryLoaded(true);
      return items;
    } catch (error) {
      if (isOpenRequest && requestId !== openSessionsRequestId.current) {
        return [];
      }
      setErrorMessage(
        getApiErrorMessage(error, "No se pudo cargar el historial de sesiones.")
      );
      setHistoryLoaded(true);
      return [];
    } finally {
      if (!isOpenRequest || requestId === openSessionsRequestId.current) {
        setLoadingHistory(false);
      }
    }
  }, []);

  const loadAvailableOpenSessions = useCallback(
    async (filters: CashSessionHistoryFilters = {}) => {
      const requestId = ++openSessionsRequestId.current;
      setAvailableOpenSessions([]);
      setErrorMessage(null);
      try {
        const items = await listCashSessionHistory({
          ...filters,
          status: "OPEN",
          limit: 100,
          offset: 0,
        });
        if (requestId !== openSessionsRequestId.current) {
          return [];
        }
        setAvailableOpenSessions(items);
        return items;
      } catch (error) {
        if (requestId !== openSessionsRequestId.current) {
          return [];
        }
        setErrorMessage(
          getApiErrorMessage(error, "No se pudieron cargar las sesiones abiertas.")
        );
        setAvailableOpenSessions([]);
        return [];
      }
    },
    []
  );

  const selectCurrentSession = useCallback((session: CashSession | null) => {
    setCurrentSession(session);
    setSessionSummary(null);
  }, []);

  const openSession = useCallback(async (payload: OpenCashSessionPayload) => {
    setSaving(true);
    try {
      const created = await openCashSession(payload);
      setCurrentSession(created);
      setSessionSummary(null);
      setHistory((prev) => [created, ...prev]);
      return created;
    } finally {
      setSaving(false);
    }
  }, []);

  const closeSession = useCallback(
    async (cashSessionId: string, payload: CloseCashSessionPayload) => {
      setSaving(true);
      try {
        const closed = await closeCashSession(cashSessionId, payload);
        if (closed.closureProgress?.isComplete !== false) {
          setCurrentSession((prev) => (prev?.id === cashSessionId ? null : prev));
          setSessionSummary((prev) => (prev?.sessionId === cashSessionId ? null : prev));
        }
        setHistory((prev) =>
          prev.map((item) => (item.id === cashSessionId ? closed : item))
        );
        return closed;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return {
    currentSession,
    availableOpenSessions,
    history,
    sessionSummary,
    loadingCurrent,
    loadingHistory,
    loadingSummary,
    saving,
    errorMessage,
    historyLoaded,
    setErrorMessage,
    loadCurrentSession,
    loadHistory,
    loadAvailableOpenSessions,
    loadSessionSummary,
    selectCurrentSession,
    openSession,
    closeSession,
  };
};
