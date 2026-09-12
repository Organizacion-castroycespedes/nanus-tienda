"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../../lib/request";
import { fetchOperationalSales } from "../services/operational-sales.service";
import {
  emptyOperationalSalesFilters,
  type OperationalSalesFilters,
  type OperationalSalesResponse,
} from "../types";

const emptyResponse: OperationalSalesResponse = {
  items: [],
  page: 1,
  limit: 25,
  total: 0,
  sortBy: "createdAt",
  sortDirection: "DESC",
};

const friendlyError = (error: unknown) => {
  if (error instanceof ApiError && error.status === 403) {
    if (error.message.toLowerCase().includes("turno")) {
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

export const useOperationalSales = () => {
  const [filters, setFilters] = useState<OperationalSalesFilters>(emptyOperationalSalesFilters);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"createdAt" | "total" | "status">("createdAt");
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("DESC");
  const [data, setData] = useState(emptyResponse);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchOperationalSales({ page, limit: 25, sortBy, sortDirection, filters }));
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally {
      setLoading(false);
    }
  }, [filters, page, sortBy, sortDirection]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateFilter = (key: keyof OperationalSalesFilters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const resetFilters = () => {
    setPage(1);
    setFilters(emptyOperationalSalesFilters);
  };

  const toggleSort = (field: "createdAt" | "total" | "status") => {
    setPage(1);
    if (sortBy === field) {
      setSortDirection((current) => (current === "ASC" ? "DESC" : "ASC"));
      return;
    }
    setSortBy(field);
    setSortDirection(field === "createdAt" ? "DESC" : "ASC");
  };

  return {
    data,
    filters,
    loading,
    error,
    page,
    setPage,
    resetFilters,
    updateFilter,
    toggleSort,
  };
};
