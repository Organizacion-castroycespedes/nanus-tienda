"use client";

import { useCallback, useState } from "react";
import {
  createCashMovement,
  listCashMovements,
} from "../services/finance.service";
import type {
  CashMovement,
  CashMovementFilters,
  CreateCashMovementPayload,
} from "../types";

export const useCashMovements = () => {
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadMovements = useCallback(async (filters: CashMovementFilters = {}) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const items = await listCashMovements(filters);
      setMovements(items);
      setHasLoaded(true);
      return items;
    } catch {
      setErrorMessage("No se pudieron cargar los movimientos.");
      setHasLoaded(true);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createItem = useCallback(async (payload: CreateCashMovementPayload) => {
    setSaving(true);
    try {
      const created = await createCashMovement(payload);
      setMovements((prev) => [created, ...prev]);
      return created;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    movements,
    loading,
    saving,
    errorMessage,
    hasLoaded,
    setErrorMessage,
    loadMovements,
    createItem,
  };
};
