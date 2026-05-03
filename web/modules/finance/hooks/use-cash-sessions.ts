"use client";

import { useCallback, useState } from "react";
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

export const useCashSessions = () => {
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [sessionSummary, setSessionSummary] = useState<CashSessionSummary | null>(null);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const loadCurrentSession = useCallback(async (cashRegisterId?: string) => {
    setLoadingCurrent(true);
    setErrorMessage(null);
    try {
      const session = await getCurrentCashSession(cashRegisterId);
      setCurrentSession(session);
      return session;
    } catch {
      setErrorMessage("No se pudo consultar la caja actual.");
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
    } catch {
      setErrorMessage("No se pudo cargar el resumen de la caja.");
      return null;
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const loadHistory = useCallback(async (filters: CashSessionHistoryFilters = {}) => {
    setLoadingHistory(true);
    setErrorMessage(null);
    try {
      const items = await listCashSessionHistory(filters);
      setHistory(items);
      setHistoryLoaded(true);
      return items;
    } catch {
      setErrorMessage("No se pudo cargar el historial de sesiones.");
      setHistoryLoaded(true);
      return [];
    } finally {
      setLoadingHistory(false);
    }
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
        setCurrentSession((prev) => (prev?.id === cashSessionId ? null : prev));
        setSessionSummary((prev) => (prev?.sessionId === cashSessionId ? null : prev));
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
    loadSessionSummary,
    openSession,
    closeSession,
  };
};
