"use client";

import { useCallback, useState } from "react";
import {
  createFinancialInstitution,
  deactivateFinancialInstitution,
  listFinancialInstitutions,
  savePaymentMethodFinancialInstitutions,
  updateFinancialInstitution,
} from "../services/finance.service";
import type { FinancialInstitution } from "../types";

export const useFinancialInstitutions = () => {
  const [financialInstitutions, setFinancialInstitutions] = useState<FinancialInstitution[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadFinancialInstitutions = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await listFinancialInstitutions(undefined, "all");
      setFinancialInstitutions(Array.isArray(data) ? data : []);
      return data;
    } catch (error: any) {
      setFinancialInstitutions([]);
      setErrorMessage(error?.message || "No se pudieron cargar las entidades financieras");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMethodInstitutions = useCallback(async (paymentMethodId: string) => {
    return listFinancialInstitutions(paymentMethodId, true);
  }, []);

  const createItem = useCallback(async (payload: Partial<FinancialInstitution>) => {
    setSaving(true);
    setErrorMessage(null);
    try {
      const created = await createFinancialInstitution(payload);
      setFinancialInstitutions((prev) => [...prev, created]);
      return created;
    } catch (error: any) {
      setErrorMessage(error?.message || "Error al crear entidad financiera");
      throw error;
    } finally {
      setSaving(false);
    }
  }, []);

  const updateItem = useCallback(async (id: string, payload: Partial<FinancialInstitution>) => {
    setSaving(true);
    setErrorMessage(null);
    try {
      const updated = await updateFinancialInstitution(id, payload);
      setFinancialInstitutions((prev) => prev.map((item) => (item.id === id ? updated : item)));
      return updated;
    } catch (error: any) {
      setErrorMessage(error?.message || "Error al actualizar entidad financiera");
      throw error;
    } finally {
      setSaving(false);
    }
  }, []);

  const toggleStatus = useCallback(async (institution: FinancialInstitution) => {
    setSaving(true);
    setErrorMessage(null);
    try {
      const updated = institution.active
        ? await deactivateFinancialInstitution(institution.id)
        : await updateFinancialInstitution(institution.id, { active: true });
      setFinancialInstitutions((prev) =>
        prev.map((item) => (item.id === institution.id ? updated : item))
      );
      return updated;
    } catch (error: any) {
      setErrorMessage(error?.message || "Error al cambiar estado");
      throw error;
    } finally {
      setSaving(false);
    }
  }, []);

  const saveMethodInstitutions = useCallback(
    async (paymentMethodId: string, financialInstitutionIds: string[]) => {
      setSaving(true);
      setErrorMessage(null);
      try {
        return await savePaymentMethodFinancialInstitutions(
          paymentMethodId,
          financialInstitutionIds
        );
      } catch (error: any) {
        setErrorMessage(error?.message || "Error al asignar entidades financieras");
        throw error;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return {
    financialInstitutions,
    loading,
    saving,
    errorMessage,
    loadFinancialInstitutions,
    loadMethodInstitutions,
    createItem,
    updateItem,
    toggleStatus,
    saveMethodInstitutions,
  };
};
