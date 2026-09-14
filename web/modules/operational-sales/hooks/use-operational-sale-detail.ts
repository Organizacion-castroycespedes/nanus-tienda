"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../../lib/request";
import {
  fetchOperationalSaleDetail,
  requestOperationalSaleElectronicBilling,
  refreshOperationalSaleBillingStatus,
  retryOperationalSaleBilling,
} from "../services/operational-sales.service";
import type { OperationalSaleDetail } from "../types";

export const useOperationalSaleDetail = (saleId: string) => {
  const [data, setData] = useState<OperationalSaleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void fetchOperationalSaleDetail(saleId)
      .then((response) => {
        if (active) {
          setData(response);
        }
      })
      .catch((requestError: unknown) => {
        if (!active) {
          return;
        }
        if (requestError instanceof ApiError && requestError.status === 403) {
          setError("No tienes permisos para consultar esta venta.");
        } else if (requestError instanceof ApiError && requestError.status === 404) {
          setError("La venta no existe o no está dentro de tu alcance operativo.");
        } else {
          setError("No se pudo cargar el detalle de la venta.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [saleId]);

  useEffect(() => load(), [load]);

  const refreshBillingStatus = useCallback(async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const response = await refreshOperationalSaleBillingStatus(saleId);
      setData(response);
      setActionMessage("Estado FE actualizado.");
    } catch {
      setActionMessage("No fue posible consultar el estado FE.");
    } finally {
      setActionLoading(false);
    }
  }, [actionLoading, saleId]);

  const retryBilling = useCallback(async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const response = await retryOperationalSaleBilling(saleId);
      setData(response);
      setActionMessage(response.retryResult?.safeUserMessage ?? "Procesamiento FE actualizado.");
    } catch {
      setActionMessage("No fue posible reintentar el procesamiento FE.");
    } finally {
      setActionLoading(false);
    }
  }, [actionLoading, saleId]);

  const requestBilling = useCallback(async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const response = await requestOperationalSaleElectronicBilling(saleId);
      if (response.requestCreated) {
        setActionMessage("Solicitud de facturación electrónica creada. Actualiza el estado FE para consultar el avance.");
      } else {
        setActionMessage(`No se creó una nueva solicitud: ${response.eligibility}.`);
      }
      const refreshed = await fetchOperationalSaleDetail(saleId);
      setData(refreshed);
    } catch (requestError: unknown) {
      const message = requestError instanceof ApiError
        ? requestError.message.replace(/\s+/g, " ").trim().slice(0, 300)
        : "No fue posible solicitar la factura electrónica.";
      setActionMessage(message || "No fue posible solicitar la factura electrónica.");
    } finally {
      setActionLoading(false);
    }
  }, [actionLoading, saleId]);

  return {
    data,
    loading,
    error,
    reload: load,
    refreshBillingStatus,
    retryBilling,
    requestBilling,
    actionLoading,
    actionMessage,
  };
};
