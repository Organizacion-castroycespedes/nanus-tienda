"use client";

import { useCallback, useState } from "react";
import { getPurchasesReport } from "../services/reporting.service";
import type { PurchasesListDataset, ReportFilters } from "../types";
import { getApiErrorMessage } from "../utils";

export const usePurchasesReports = () => {
  const [dataset, setDataset] = useState<PurchasesListDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async (filters: ReportFilters) => {
    setLoading(true);
    setError(null);
    try {
      const response = await getPurchasesReport(filters);
      setDataset(response);
      setSearched(true);
      return response;
    } catch (error) {
      const message = getApiErrorMessage(error, "No se pudo cargar el reporte de compras.");
      setError(message);
      setSearched(true);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    dataset,
    loading,
    searched,
    error,
    loadReports,
  };
};
