"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError } from "../../../lib/request";
import { fetchOperationalSales } from "../services/operational-sales.service";
import { emptyOperationalSalesFilters, type OperationalSalesFilters, type OperationalSalesResponse } from "../types";

const emptyResponse: OperationalSalesResponse = { items: [], page: 1, limit: 25, total: 0, sortBy: "createdAt", sortDirection: "DESC" };
const friendlyError = (error: unknown) => {
  if (error instanceof ApiError && error.status === 403) {
    const message = error.message.toLowerCase();
    if (message.includes("sucursal")) {
      return "Selecciona una sucursal y una terminal POS antes de consultar ventas operativas.";
    }
    if (message.includes("sesion pos") || message.includes("pos session")) {
      return "Selecciona una terminal POS antes de consultar ventas operativas.";
    }
    if (message.includes("turno")) {
      return "No tienes un turno de caja abierto para consultar ventas operativas.";
    }
    return "No tienes permisos para consultar ventas operativas.";
  }
  if (error instanceof ApiError && error.status === 401) {
    return "Tu sesión terminó. Inicia sesión nuevamente.";
  }
  if (error instanceof ApiError && error.status === 400) {
    return "Revisa los filtros seleccionados.";
  }
  return "No se pudieron cargar las ventas operativas.";
};

export const getDefaultOperationalSalesFilters = (role?: string): OperationalSalesFilters => {
  const normalizedRole = (role ?? "").toUpperCase();
  const isAdmin = ["ADMIN", "SUPER_USER", "SUPER_ADMIN"].includes(normalizedRole);
  if (isAdmin) {
    const now = new Date();
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(now.getDate() - 2);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateTo = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const dateFrom = `${twoDaysAgo.getFullYear()}-${pad(twoDaysAgo.getMonth() + 1)}-${pad(twoDaysAgo.getDate())}`;
    return {
      ...emptyOperationalSalesFilters,
      dateFrom,
      dateTo,
    };
  }
  return emptyOperationalSalesFilters;
};

export const useOperationalSales = (initialFilters?: OperationalSalesFilters) => {
  const [filters, setFilters] = useState<OperationalSalesFilters>(
    initialFilters ?? emptyOperationalSalesFilters
  );
  const [appliedFilters, setAppliedFilters] = useState<OperationalSalesFilters | null>(
    initialFilters ?? null
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<"createdAt" | "total" | "status">("createdAt");
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("DESC");
  const [data, setData] = useState(emptyResponse);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const initialized = useRef(false);

  const load = useCallback(async (nextPage: number, nextPageSize: number, nextSortBy: typeof sortBy, nextSortDirection: typeof sortDirection, nextFilters: OperationalSalesFilters) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchOperationalSales({ page: nextPage, limit: nextPageSize, sortBy: nextSortBy, sortDirection: nextSortDirection, filters: nextFilters });
      if (currentRequest === requestId.current) setData(result);
    } catch (requestError) {
      if (currentRequest === requestId.current) setError(friendlyError(requestError));
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      const initial = initialFilters ?? emptyOperationalSalesFilters;
      setFilters(initial);
      setAppliedFilters(initial);
      void load(1, pageSize, sortBy, sortDirection, initial);
    }
  }, [initialFilters, load, pageSize, sortBy, sortDirection]);

  const updateFilter = (key: keyof OperationalSalesFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () => {
    const reset = initialFilters ?? emptyOperationalSalesFilters;
    setFilters(reset);
    setAppliedFilters(reset);
    setPage(1);
    void load(1, pageSize, sortBy, sortDirection, reset);
  };
  const search = () => {
    const nextFilters = { ...filters };
    setAppliedFilters(nextFilters);
    setPage(1);
    void load(1, pageSize, sortBy, sortDirection, nextFilters);
  };
  const changePage = (nextPage: number) => {
    if (!appliedFilters || loading) return;
    setPage(nextPage);
    void load(nextPage, pageSize, sortBy, sortDirection, appliedFilters);
  };
  const changePageSize = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    if (appliedFilters) {
      setPage(1);
      void load(1, nextPageSize, sortBy, sortDirection, appliedFilters);
    }
  };
  const toggleSort = (field: "createdAt" | "total" | "status") => {
    if (!appliedFilters || loading) return;
    const nextDirection = sortBy === field ? (sortDirection === "ASC" ? "DESC" : "ASC") : field === "createdAt" ? "DESC" : "ASC";
    setPage(1);
    setSortBy(field);
    setSortDirection(nextDirection);
    void load(1, pageSize, field, nextDirection, appliedFilters);
  };

  return { data, filters, appliedFilters, loading, error, page, pageSize, setPage: changePage, setPageSize: changePageSize, search, resetFilters, updateFilter, toggleSort, reload: ()=> load(1, pageSize, sortBy, sortDirection, filters), };
};
