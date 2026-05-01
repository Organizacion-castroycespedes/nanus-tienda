"use client";

import { useCallback, useState } from "react";
import {
  createPaymentMethod,
  deactivatePaymentMethod,
  listPaymentMethods,
  updatePaymentMethod,
} from "../services/finance.service";
import type {
  CreatePaymentMethodPayload,
  PaymentMethod,
  PaymentMethodFilters,
  UpdatePaymentMethodPayload,
} from "../types";

export const usePaymentMethods = () => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadPaymentMethods = useCallback(async (filters: PaymentMethodFilters = {}) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const items = await listPaymentMethods(filters);
      setPaymentMethods(items);
      setHasLoaded(true);
      return items;
    } catch {
      setErrorMessage("No se pudieron cargar los metodos de pago.");
      setHasLoaded(true);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createItem = useCallback(async (payload: CreatePaymentMethodPayload) => {
    setSaving(true);
    try {
      const created = await createPaymentMethod(payload);
      setPaymentMethods((prev) => [created, ...prev]);
      return created;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateItem = useCallback(
    async (paymentMethodId: string, payload: UpdatePaymentMethodPayload) => {
      setSaving(true);
      try {
        const updated = await updatePaymentMethod(paymentMethodId, payload);
        setPaymentMethods((prev) =>
          prev.map((item) => (item.id === paymentMethodId ? updated : item))
        );
        return updated;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const toggleStatus = useCallback(
    async (paymentMethod: PaymentMethod) => {
      const optimistic = {
        ...paymentMethod,
        active: !paymentMethod.active,
      };

      setPaymentMethods((prev) =>
        prev.map((item) => (item.id === paymentMethod.id ? optimistic : item))
      );

      try {
        const updated = paymentMethod.active
          ? await deactivatePaymentMethod(paymentMethod.id)
          : await updatePaymentMethod(paymentMethod.id, { active: true });

        setPaymentMethods((prev) =>
          prev.map((item) => (item.id === paymentMethod.id ? updated : item))
        );
        return updated;
      } catch (error) {
        setPaymentMethods((prev) =>
          prev.map((item) => (item.id === paymentMethod.id ? paymentMethod : item))
        );
        throw error;
      }
    },
    []
  );

  return {
    paymentMethods,
    loading,
    saving,
    errorMessage,
    hasLoaded,
    setErrorMessage,
    loadPaymentMethods,
    createItem,
    updateItem,
    toggleStatus,
  };
};
