"use client";

import { useCallback, useState } from "react";
import {
  createCashMovement,
  listCashMovements,
} from "../services/finance.service";
import type {
  CashMovement,
  CashMovementFilters,
  CashMovementListResponse,
  CashMovementPaymentMethodSummary,
  CashMovementSummary,
  CreateCashMovementPayload,
} from "../types";

export const useCashMovements = () => {
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [summary, setSummary] = useState<CashMovementSummary | null>(null);
  const [byPaymentMethod, setByPaymentMethod] = useState<
    CashMovementPaymentMethodSummary[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadMovements = useCallback(async (filters: CashMovementFilters = {}) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await listCashMovements({
        ...filters,
        includeSummary: true,
      });
      const normalized = Array.isArray(response)
        ? {
            summary: {
              totalIn: response
                .filter((item) => item.direction === "IN")
                .reduce((sum, item) => sum + item.amount, 0),
              totalOut: response
                .filter((item) => item.direction === "OUT")
                .reduce((sum, item) => sum + item.amount, 0),
              balance:
                response
                  .filter((item) => item.direction === "IN")
                  .reduce((sum, item) => sum + item.amount, 0) -
                response
                  .filter((item) => item.direction === "OUT")
                  .reduce((sum, item) => sum + item.amount, 0),
              movementCount: response.length,
            },
            byPaymentMethod: [],
            items: response,
          }
        : response;
      setMovements(normalized.items);
      setSummary(normalized.summary);
      setByPaymentMethod(normalized.byPaymentMethod);
      setHasLoaded(true);
      return normalized;
    } catch {
      setErrorMessage("No se pudieron cargar los movimientos.");
      setSummary(null);
      setByPaymentMethod([]);
      setHasLoaded(true);
      return null;
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
    summary,
    byPaymentMethod,
    loading,
    saving,
    errorMessage,
    hasLoaded,
    setErrorMessage,
    loadMovements,
    createItem,
  };
};
