"use client";

import { useCallback, useState } from "react";
import {
  getCashClosingsReport,
  getPosSalesReport,
} from "../services/reporting.service";
import type {
  CashClosingListDataset,
  PosSalesListDataset,
  ReportFilters,
} from "../types";
import { getApiErrorMessage } from "../utils";

type ReportingOverviewState = {
  pos: PosSalesListDataset | null;
  closings: CashClosingListDataset | null;
};

export const useReportingOverview = () => {
  const [overview, setOverview] = useState<ReportingOverviewState>({
    pos: null,
    closings: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async (filters: ReportFilters) => {
    setLoading(true);
    setError(null);
    try {
      const [pos, closings] = await Promise.all([
        getPosSalesReport(filters),
        getCashClosingsReport(filters),
      ]);

      const nextOverview = { pos, closings };
      setOverview(nextOverview);
      return nextOverview;
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        "No se pudo cargar el resumen operativo de reporteria."
      );
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    overview,
    loading,
    error,
    loadOverview,
  };
};
