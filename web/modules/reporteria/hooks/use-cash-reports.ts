"use client";

import { useCallback, useState } from "react";
import {
  getCashAuditsReport,
  getCashClosingsReport,
} from "../services/reporting.service";
import type {
  CashAuditListDataset,
  CashClosingListDataset,
  ReportFilters,
} from "../types";
import { getApiErrorMessage } from "../utils";

export const useCashReports = () => {
  const [closingsDataset, setClosingsDataset] = useState<CashClosingListDataset | null>(null);
  const [auditsDataset, setAuditsDataset] = useState<CashAuditListDataset | null>(null);
  const [loadingClosings, setLoadingClosings] = useState(false);
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [searched, setSearched] = useState(false);
  const [closingsError, setClosingsError] = useState<string | null>(null);
  const [auditsError, setAuditsError] = useState<string | null>(null);

  const loadClosings = useCallback(async (filters: ReportFilters) => {
    setLoadingClosings(true);
    setClosingsError(null);
    try {
      const response = await getCashClosingsReport(filters);
      setClosingsDataset(response);
      setSearched(true);
      return response;
    } catch (error) {
      const message = getApiErrorMessage(error, "No se pudo cargar el reporte de cierres.");
      setClosingsError(message);
      setSearched(true);
      return null;
    } finally {
      setLoadingClosings(false);
    }
  }, []);

  const loadAudits = useCallback(async (filters: ReportFilters) => {
    setLoadingAudits(true);
    setAuditsError(null);
    try {
      const response = await getCashAuditsReport(filters);
      setAuditsDataset(response);
      setSearched(true);
      return response;
    } catch (error) {
      const message = getApiErrorMessage(error, "No se pudo cargar el reporte de arqueos.");
      setAuditsError(message);
      setSearched(true);
      return null;
    } finally {
      setLoadingAudits(false);
    }
  }, []);

  return {
    closingsDataset,
    auditsDataset,
    loadingClosings,
    loadingAudits,
    searched,
    closingsError,
    auditsError,
    loadClosings,
    loadAudits,
  };
};
