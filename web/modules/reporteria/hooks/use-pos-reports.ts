"use client";

import { useCallback, useState } from "react";
import { getPosSalesReport } from "../services/reporting.service";
import type { PosSalesListDataset, ReportFilters } from "../types";
import { getApiErrorMessage } from "../utils";

export const usePosReports = () => {
  const [dataset, setDataset] = useState<PosSalesListDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async (filters: ReportFilters) => {
    setLoading(true);
    setError(null);
    try {
      const response = await getPosSalesReport(filters);
      setDataset(response);
      setSearched(true);
      return response;
    } catch (error) {
      const message = getApiErrorMessage(error, "No se pudo cargar el reporte POS.");
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
