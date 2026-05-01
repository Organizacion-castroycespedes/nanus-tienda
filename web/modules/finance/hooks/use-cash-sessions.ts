"use client";

import { useCallback, useState } from "react";
import {
  closeCashSession,
  getCurrentCashSession,
  listCashSessionHistory,
  openCashSession,
} from "../services/finance.service";
import type {
  CashSession,
  CashSessionHistoryFilters,
  CloseCashSessionPayload,
  OpenCashSessionPayload,
} from "../types";

export const useCashSessions = () => {
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
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
    loadingCurrent,
    loadingHistory,
    saving,
    errorMessage,
    historyLoaded,
    setErrorMessage,
    loadCurrentSession,
    loadHistory,
    openSession,
    closeSession,
  };
};
