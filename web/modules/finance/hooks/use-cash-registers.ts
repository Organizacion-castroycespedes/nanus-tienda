"use client";

import { useCallback, useState } from "react";
import {
  createCashRegister,
  listCashRegisters,
  updateCashRegister,
} from "../services/finance.service";
import type {
  CashRegister,
  CashRegisterFilters,
  CreateCashRegisterPayload,
  UpdateCashRegisterPayload,
} from "../types";

export const useCashRegisters = () => {
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadCashRegisters = useCallback(async (filters: CashRegisterFilters = {}) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const items = await listCashRegisters(filters);
      setCashRegisters(items);
      setHasLoaded(true);
      return items;
    } catch {
      setErrorMessage("No se pudieron cargar las cajas.");
      setHasLoaded(true);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createItem = useCallback(async (payload: CreateCashRegisterPayload) => {
    setSaving(true);
    try {
      const created = await createCashRegister(payload);
      setCashRegisters((prev) => [created, ...prev]);
      return created;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateItem = useCallback(
    async (cashRegisterId: string, payload: UpdateCashRegisterPayload) => {
      setSaving(true);
      try {
        const updated = await updateCashRegister(cashRegisterId, payload);
        setCashRegisters((prev) =>
          prev.map((item) => (item.id === cashRegisterId ? updated : item))
        );
        return updated;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return {
    cashRegisters,
    loading,
    saving,
    errorMessage,
    hasLoaded,
    setErrorMessage,
    loadCashRegisters,
    createItem,
    updateItem,
  };
};
