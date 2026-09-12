"use client";

import { useState, useEffect } from "react";
import type { PosStockFilterKey } from "../utils/product-classification";

type ProductViewMode = "grid" | "list";

type PosFiltersState = {
  activeStockFilter: PosStockFilterKey;
  selectedProductCategoryId: string;
  selectedProductSubcategoryId: string;
  productViewMode: ProductViewMode;
};

const POS_FILTERS_STORAGE_KEY = "manus.pos.filters-state";

const DEFAULT_STATE: PosFiltersState = {
  activeStockFilter: "available",
  selectedProductCategoryId: "",
  selectedProductSubcategoryId: "",
  productViewMode: "grid",
};

export const usePosFiltersStorage = () => {
  const [filters, setFilters] = useState<PosFiltersState>(DEFAULT_STATE);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = window.sessionStorage.getItem(POS_FILTERS_STORAGE_KEY);
      if (stored) {
        setFilters(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load POS filters from session storage:", error);
    }
  }, []);

  const updateFilters = (updates: Partial<PosFiltersState>) => {
    setFilters((current) => {
      const nextState = { ...current, ...updates };
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(
            POS_FILTERS_STORAGE_KEY,
            JSON.stringify(nextState)
          );
        } catch (error) {
          console.error("Failed to save POS filters to session storage:", error);
        }
      }
      return nextState;
    });
  };

  return {
    filters,
    updateFilters,
  };
};
