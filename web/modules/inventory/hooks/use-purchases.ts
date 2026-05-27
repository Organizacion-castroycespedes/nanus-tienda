"use client";

import { useCallback, useRef, useState } from "react";
import { getApiErrorMessage } from "../../reporteria/utils";
import {
  cancelPurchase,
  getPurchaseById,
  getPurchases,
  liquidatePurchase,
  type CancelPurchasePayload,
  type GetPurchasesParams,
  type LiquidatePurchasePayload,
  type PurchaseDetailResponse,
  type PurchaseResponse,
} from "../services/purchase.service";

const normalizePurchaseError = (error: unknown, fallback: string) =>
  getApiErrorMessage(error, fallback);

export const usePurchases = () => {
  const [purchases, setPurchases] = useState<PurchaseResponse[]>([]);
  const [purchaseDetail, setPurchaseDetail] = useState<PurchaseDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [liquidating, setLiquidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const lastFiltersRef = useRef<GetPurchasesParams>({});

  const loadPurchases = useCallback(async (filters: GetPurchasesParams = {}) => {
    lastFiltersRef.current = filters;
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await getPurchases(filters);
      setPurchases(result);
      setHasLoaded(true);
      return result;
    } catch (error) {
      setErrorMessage(normalizePurchaseError(error, "No se pudieron cargar las compras."));
      setHasLoaded(true);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPurchaseDetail = useCallback(async (purchaseId: string) => {
    setLoadingDetail(true);
    setErrorMessage(null);
    setPurchaseDetail(null);
    try {
      const result = await getPurchaseById(purchaseId);
      setPurchaseDetail(result);
      return result;
    } catch (error) {
      setErrorMessage(
        normalizePurchaseError(error, "No se pudo cargar el detalle de la compra.")
      );
      return null;
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const cancelItem = useCallback(
    async (purchaseId: string, payload: CancelPurchasePayload) => {
      setCanceling(true);
      setErrorMessage(null);
      try {
        const response = await cancelPurchase(purchaseId, payload);
        const cancelled = response.data;
        setPurchases((prev) =>
          prev.map((purchase) => (purchase.id === purchaseId ? cancelled : purchase))
        );
        setPurchaseDetail((prev) =>
          prev?.id === purchaseId
            ? {
                ...prev,
                ...cancelled,
              }
            : prev
        );
        await loadPurchases(lastFiltersRef.current);
        return response;
      } catch (error) {
        const message = normalizePurchaseError(
          error,
          "No se pudo cancelar la compra. Intenta nuevamente."
        );
        setErrorMessage(message);
        throw new Error(message);
      } finally {
        setCanceling(false);
      }
    },
    [loadPurchases]
  );

  const liquidateItem = useCallback(
    async (purchaseId: string, payload: LiquidatePurchasePayload) => {
      setLiquidating(true);
      setErrorMessage(null);
      try {
        const response = await liquidatePurchase(purchaseId, payload);
        const liquidated = response.data;
        setPurchases((prev) =>
          prev.map((purchase) => (purchase.id === purchaseId ? liquidated : purchase))
        );
        setPurchaseDetail((prev) =>
          prev?.id === purchaseId
            ? {
                ...prev,
                ...liquidated,
              }
            : prev
        );
        await loadPurchases(lastFiltersRef.current);
        return response;
      } catch (error) {
        const message = normalizePurchaseError(
          error,
          "No se pudo liquidar la compra. Intenta nuevamente."
        );
        setErrorMessage(message);
        throw new Error(message);
      } finally {
        setLiquidating(false);
      }
    },
    [loadPurchases]
  );

  return {
    purchases,
    purchaseDetail,
    loading,
    loadingDetail,
    canceling,
    liquidating,
    errorMessage,
    hasLoaded,
    setErrorMessage,
    loadPurchases,
    loadPurchaseDetail,
    cancelItem,
    liquidateItem,
  };
};
