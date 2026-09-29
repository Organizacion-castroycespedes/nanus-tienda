"use client";
import { useCallback, useEffect, useState } from "react";
import { getOperationalControl, type OperationalPeriod, type OperationalSnapshot } from "../services/operational-control.service";
export const useOperationalControl = (filters: { period: OperationalPeriod; tenantId?: string; branchId?: string; terminalId?: string; cashierId?: string }) => {
  const [data, setData] = useState<OperationalSnapshot | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async (signal?: AbortSignal) => { setLoading(true); setError(null); try { setData(await getOperationalControl(filters, signal)); } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "No se pudo cargar el centro de control."); } finally { if (!signal?.aborted) setLoading(false); } }, [filters]);
  useEffect(() => { const controller = new AbortController(); void reload(controller.signal); return () => controller.abort(); }, [reload]);
  return { data, loading, error, reload };
};
