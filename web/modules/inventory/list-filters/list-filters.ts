/**
 * Reglas puras de los paneles de filtros colapsables de pedidos y compras
 * (change mejorar-filtros-alcance-cobro-orders-purchases, D1).
 */

export const LIST_FILTERS_STORAGE_PREFIX = "manus.listFilters.";

type FilterValues = Record<string, string | null | undefined>;

/**
 * Cuenta los filtros cuyo valor difiere del valor por defecto, más los
 * indicadores adicionales activos (por ejemplo, alcance "Caja actual").
 */
export const countActiveListFilters = (
  filters: FilterValues,
  defaults: FilterValues,
  extraActive: readonly boolean[] = []
) =>
  Object.keys(defaults).filter(
    (key) => (filters[key] ?? "").trim() !== (defaults[key] ?? "").trim()
  ).length + extraActive.filter(Boolean).length;

export const formatListFiltersTitle = (activeCount: number) =>
  activeCount > 0 ? `Filtros (${activeCount})` : "Filtros";

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

const resolveStorage = (): Storage | null => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

/** Preferencia mostrar/ocultar; sin almacenamiento disponible devuelve el valor por defecto. */
export const readFiltersPanelOpen = (
  key: string,
  fallback = false,
  storage: ReadableStorage | null = resolveStorage()
) => {
  try {
    const value = storage?.getItem(`${LIST_FILTERS_STORAGE_PREFIX}${key}`);
    if (value === "open") {
      return true;
    }
    if (value === "closed") {
      return false;
    }
  } catch {
    // Almacenamiento bloqueado: se usa el valor por defecto.
  }
  return fallback;
};

export const writeFiltersPanelOpen = (
  key: string,
  open: boolean,
  storage: WritableStorage | null = resolveStorage()
) => {
  try {
    storage?.setItem(`${LIST_FILTERS_STORAGE_PREFIX}${key}`, open ? "open" : "closed");
  } catch {
    // Almacenamiento bloqueado o lleno: la preferencia no se guarda.
  }
};
