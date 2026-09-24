"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError } from "../../../lib/request";
import { fetchOperationalSales } from "../services/operational-sales.service";
import { emptyOperationalSalesFilters, type OperationalSalesFilters, type OperationalSalesResponse } from "../types";

const emptyResponse: OperationalSalesResponse = { items: [], page: 1, limit: 25, total: 0, sortBy: "createdAt", sortDirection: "DESC" };
const friendlyError = (error: unknown) => {
  if (error instanceof ApiError && error.status === 403) return error.message.toLowerCase().includes("turno") ? "No tienes un turno de caja abierto para consultar ventas operativas." : "No tienes permisos para consultar ventas operativas.";
  if (error instanceof ApiError && error.status === 401) return "Tu sesión terminó. Inicia sesión nuevamente.";
  if (error instanceof ApiError && error.status === 400) return "Revisa los filtros seleccionados.";
  return "No se pudieron cargar las ventas operativas.";
};

export const useOperationalSales = () => {
  const [filters, setFilters] = useState<OperationalSalesFilters>(emptyOperationalSalesFilters);
  const [appliedFilters, setAppliedFilters] = useState<OperationalSalesFilters | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<"createdAt" | "total" | "status">("createdAt");
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("DESC");
  const [data, setData] = useState(emptyResponse);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

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

  const updateFilter = (key: keyof OperationalSalesFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () => setFilters(emptyOperationalSalesFilters);
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

  return { data, filters, appliedFilters, loading, error, page, pageSize, setPage: changePage, setPageSize: changePageSize, search, resetFilters, updateFilter, toggleSort };
};
