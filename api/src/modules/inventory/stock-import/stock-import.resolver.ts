import {
  isValidIsoDate,
  parseImportNumber,
  type XlsxImportRawRow,
} from "../imports/xlsx-import.parser";
import type { StockImportColumnKey } from "./stock-import.columns";

export type StockImportRawRow = XlsxImportRawRow<StockImportColumnKey>;

export type StockImportLotStatus =
  | "ACTIVE"
  | "EXPIRED"
  | "BLOCKED"
  | "CONSUMED"
  | "CANCELLED";

export type StockImportCatalogs = {
  branches: Array<{ id: string; code: string; name: string; isActive: boolean }>;
  accessibleBranchIds: Set<string>;
  products: Array<{
    id: string;
    sku: string;
    name: string;
    isActive: boolean;
    requiresLot: boolean;
    requiresExpiration: boolean;
    cost: number;
  }>;
  barcodes: Array<{ barcode: string; productId: string }>;
  currentStock: Array<{ productId: string; branchId: string; quantity: number }>;
  lots: Array<{
    id: string;
    productId: string;
    branchId: string;
    lotCode: string;
    expirationDate: string | null;
    status: StockImportLotStatus;
    onHand: number;
    reserved: number;
    balanceCount: number;
    locationId: string | null;
  }>;
};

export type StockImportAction = "IN" | "OUT" | "NONE";

export type StockImportLotPlan = {
  lotId: string | null;
  lotCode: string;
  isNew: boolean;
  locationId: string | null;
  expirationDate: string | null;
  unitCost: number;
};

export type StockImportRowPlan = {
  rowNumber: number;
  sku: string;
  productId: string | null;
  productName: string;
  branchId: string | null;
  branchCode: string;
  lot: StockImportLotPlan | null;
  before: number;
  target: number;
  delta: number;
  action: StockImportAction;
  skipped: boolean;
  movementStockBefore: number;
  movementStockAfter: number;
  errors: string[];
  warnings: string[];
};

export type StockImportReport = {
  rows: StockImportRowPlan[];
  summary: {
    total: number;
    in: number;
    out: number;
    unchanged: number;
    withErrors: number;
    withWarnings: number;
    quantityIn: number;
    quantityOut: number;
  };
  canCommit: boolean;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUANTITY_DECIMALS = 1e6;

function roundQuantity(value: number) {
  return Math.round(value * QUANTITY_DECIMALS) / QUANTITY_DECIMALS;
}

function formatQuantity(value: number) {
  return String(roundQuantity(value));
}

function normalizeCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function text(row: StockImportRawRow, key: StockImportColumnKey) {
  const value = row.values[key]?.trim();
  return value ? value : undefined;
}

function stockKey(productId: string, branchId: string) {
  return `${productId}|${branchId}`;
}

function lotKey(productId: string, branchId: string, lotCode: string) {
  return `${productId}|${branchId}|${lotCode}`;
}

type ProductRef = StockImportCatalogs["products"][number];
type BranchRef = StockImportCatalogs["branches"][number];

function resolveProduct(
  row: StockImportRawRow,
  indexes: {
    byId: Map<string, ProductRef>;
    bySku: Map<string, ProductRef>;
    byBarcode: Map<string, ProductRef>;
  },
  errors: string[]
): ProductRef | null {
  const productIdText = text(row, "producto_id");
  const skuText = text(row, "sku");
  const barcodeText = text(row, "codigo_barras");

  if (!productIdText && !skuText && !barcodeText) {
    errors.push("Falta el producto: usa sku, codigo_barras o producto_id.");
    return null;
  }

  const candidates: ProductRef[] = [];
  if (productIdText) {
    if (!UUID_PATTERN.test(productIdText)) {
      errors.push(`producto_id "${productIdText}" no es un UUID válido.`);
      return null;
    }
    const product = indexes.byId.get(productIdText.toLowerCase());
    if (!product) {
      errors.push(`No existe un producto con producto_id "${productIdText}".`);
      return null;
    }
    candidates.push(product);
  }
  if (skuText) {
    const product = indexes.bySku.get(skuText.toUpperCase());
    if (!product) {
      errors.push(`No existe un producto con SKU "${skuText}".`);
      return null;
    }
    candidates.push(product);
  }
  if (barcodeText) {
    const product = indexes.byBarcode.get(barcodeText);
    if (!product) {
      errors.push(`No existe un producto con código de barras "${barcodeText}".`);
      return null;
    }
    candidates.push(product);
  }

  const distinct = new Set(candidates.map((product) => product.id));
  if (distinct.size > 1) {
    errors.push("sku, codigo_barras y producto_id apuntan a productos distintos.");
    return null;
  }
  return candidates[0];
}

function resolveBranch(
  row: StockImportRawRow,
  catalogs: StockImportCatalogs,
  errors: string[]
): BranchRef | null {
  const branchIdText = text(row, "sucursal_id");
  const branchText = text(row, "sucursal");
  let branch: BranchRef | undefined;

  if (branchIdText) {
    branch = catalogs.branches.find(
      (item) => item.id.toLowerCase() === branchIdText.toLowerCase()
    );
    if (!branch) {
      errors.push(`No existe la sucursal con sucursal_id "${branchIdText}".`);
      return null;
    }
  } else if (branchText) {
    const normalized = normalizeCode(branchText);
    branch =
      catalogs.branches.find((item) => normalizeCode(item.code) === normalized) ??
      catalogs.branches.find((item) => normalizeCode(item.name) === normalized);
    if (!branch) {
      errors.push(`No existe la sucursal "${branchText}".`);
      return null;
    }
  } else {
    const active = catalogs.branches.filter((item) => item.isActive);
    if (active.length !== 1) {
      errors.push("Indica la sucursal: la empresa tiene más de una sucursal activa.");
      return null;
    }
    branch = active[0];
  }

  if (!branch.isActive) {
    errors.push(`La sucursal "${branch.code}" está inactiva.`);
    return null;
  }
  if (!catalogs.accessibleBranchIds.has(branch.id)) {
    errors.push(`No tienes acceso a la sucursal "${branch.code}".`);
    return null;
  }
  return branch;
}

function parseTarget(row: StockImportRawRow, errors: string[]) {
  const raw = text(row, "cantidad");
  if (!raw) {
    return undefined;
  }
  const value = parseImportNumber(raw);
  if (value === null || !Number.isFinite(value)) {
    errors.push(`La cantidad "${raw}" no es un número válido.`);
    return null;
  }
  if (value < 0) {
    errors.push("La cantidad no puede ser negativa.");
    return null;
  }
  return roundQuantity(value);
}

function parseUnitCost(row: StockImportRawRow, errors: string[]) {
  const raw = text(row, "costo_unitario");
  if (!raw) {
    return undefined;
  }
  const value = parseImportNumber(raw);
  if (value === null || !Number.isFinite(value) || value < 0) {
    errors.push(`El costo_unitario "${raw}" no es válido.`);
    return undefined;
  }
  return value;
}

export function resolveStockImport(
  rows: StockImportRawRow[],
  catalogs: StockImportCatalogs,
  options: { today: string }
): StockImportReport {
  const byId = new Map(catalogs.products.map((product) => [product.id.toLowerCase(), product]));
  const bySku = new Map(
    catalogs.products.map((product) => [product.sku.trim().toUpperCase(), product])
  );
  const byBarcode = new Map<string, ProductRef>();
  for (const item of catalogs.barcodes) {
    const product = byId.get(item.productId.toLowerCase());
    if (product) {
      byBarcode.set(item.barcode.trim(), product);
    }
  }
  const stockByKey = new Map(
    catalogs.currentStock.map((item) => [stockKey(item.productId, item.branchId), item.quantity])
  );
  const lotsByKey = new Map(
    catalogs.lots.map((lot) => [lotKey(lot.productId, lot.branchId, lot.lotCode.toUpperCase()), lot])
  );
  const seenKeys = new Map<string, number>();
  const runningStock = new Map<string, number>();

  const plans = [...rows]
    .sort((left, right) => left.rowNumber - right.rowNumber)
    .map((row): StockImportRowPlan => {
      const errors: string[] = [];
      const warnings: string[] = [];
      let hasOtherLots = false;
      const product = resolveProduct(row, { byId, bySku, byBarcode }, errors);
      const branch = resolveBranch(row, catalogs, errors);
      const target = parseTarget(row, errors);
      const unitCost = parseUnitCost(row, errors);
      const lotCodeText = text(row, "lote_codigo");
      const expirationText = text(row, "fecha_vencimiento");

      if (expirationText && !isValidIsoDate(expirationText)) {
        errors.push(`La fecha_vencimiento "${expirationText}" debe tener formato YYYY-MM-DD.`);
      } else if (expirationText && expirationText < "2000-01-01") {
        errors.push("La fecha_vencimiento no puede ser anterior a 2000-01-01.");
      }

      const plan: StockImportRowPlan = {
        rowNumber: row.rowNumber,
        sku: product?.sku ?? text(row, "sku") ?? "",
        productId: product?.id ?? null,
        productName: product?.name ?? text(row, "nombre") ?? "",
        branchId: branch?.id ?? null,
        branchCode: branch?.code ?? text(row, "sucursal") ?? "",
        lot: null,
        before: 0,
        target: target ?? 0,
        delta: 0,
        action: "NONE",
        skipped: false,
        movementStockBefore: 0,
        movementStockAfter: 0,
        errors,
        warnings,
      };

      if (!product || !branch || target === null) {
        return plan;
      }
      if (target === undefined) {
        plan.skipped = true;
        warnings.push("Sin cantidad: la fila se omite.");
        return plan;
      }

      if (!product.isActive) {
        warnings.push("El producto está inactivo.");
      }

      const branchKey = stockKey(product.id, branch.id);
      const branchStock = runningStock.get(branchKey) ?? stockByKey.get(branchKey) ?? 0;

      if (!product.requiresLot) {
        if (lotCodeText || expirationText) {
          errors.push("El producto no maneja lote: deja vacíos lote_codigo y fecha_vencimiento.");
        }
        if (unitCost !== undefined) {
          warnings.push("costo_unitario se ignora: el producto no maneja lote.");
        }
        const duplicateOf = seenKeys.get(branchKey);
        if (duplicateOf !== undefined) {
          errors.push(`Fila repetida: el producto y la sucursal ya vienen en la fila ${duplicateOf}.`);
        } else {
          seenKeys.set(branchKey, row.rowNumber);
        }
        plan.before = roundQuantity(branchStock);
      } else {
        if (!lotCodeText) {
          errors.push("El producto maneja lote: lote_codigo es obligatorio.");
          return plan;
        }
        const lotCode = lotCodeText.toUpperCase();
        const key = lotKey(product.id, branch.id, lotCode);
        const duplicateOf = seenKeys.get(key);
        if (duplicateOf !== undefined) {
          errors.push(`Fila repetida: el producto, la sucursal y el lote ya vienen en la fila ${duplicateOf}.`);
        } else {
          seenKeys.set(key, row.rowNumber);
        }

        const existing = lotsByKey.get(key);
        const expirationDate = expirationText && isValidIsoDate(expirationText) ? expirationText : null;

        if (existing) {
          plan.before = roundQuantity(existing.onHand);
          plan.lot = {
            lotId: existing.id,
            lotCode,
            isNew: false,
            locationId: existing.locationId,
            expirationDate: existing.expirationDate,
            unitCost: 0,
          };
          if (expirationDate && existing.expirationDate !== expirationDate) {
            errors.push(
              existing.expirationDate
                ? `La fecha_vencimiento no coincide con la del lote ${lotCode} (${existing.expirationDate}).`
                : `El lote ${lotCode} no tiene fecha de vencimiento registrada.`
            );
          }
          if (product.requiresExpiration && !existing.expirationDate && !expirationDate) {
            errors.push("El producto requiere fecha_vencimiento.");
          }
          if (unitCost !== undefined) {
            warnings.push(`costo_unitario se ignora: el lote ${lotCode} ya existe.`);
          }
          if (target < existing.reserved) {
            errors.push(
              `La cantidad (${formatQuantity(target)}) es menor que lo reservado del lote (${formatQuantity(existing.reserved)}).`
            );
          }
        } else {
          plan.before = 0;
          plan.lot = {
            lotId: null,
            lotCode,
            isNew: true,
            locationId: null,
            expirationDate,
            unitCost: unitCost ?? product.cost,
          };
          if (product.requiresExpiration && !expirationDate) {
            errors.push("El producto requiere fecha_vencimiento.");
          }
        }

        hasOtherLots = catalogs.lots.some(
          (lot) =>
            lot.productId === product.id &&
            lot.branchId === branch.id &&
            lot.lotCode.toUpperCase() !== lotCode &&
            lot.onHand > 0
        );
      }

      plan.delta = roundQuantity(target - plan.before);
      plan.action = plan.delta > 0 ? "IN" : plan.delta < 0 ? "OUT" : "NONE";

      if (plan.lot && plan.action !== "NONE") {
        const existing = plan.lot.isNew
          ? undefined
          : lotsByKey.get(lotKey(product.id, branch.id, plan.lot.lotCode));
        if (existing) {
          if (existing.balanceCount > 1) {
            errors.push(
              `El lote ${plan.lot.lotCode} tiene saldo en varias ubicaciones: ajústalo desde Lotes.`
            );
          }
          if (["BLOCKED", "CANCELLED", "CONSUMED"].includes(existing.status)) {
            errors.push(`El lote ${plan.lot.lotCode} está ${existing.status} y no se puede ajustar.`);
          } else if (plan.action === "IN" && existing.status !== "ACTIVE") {
            errors.push(`El lote ${plan.lot.lotCode} está ${existing.status} y no puede recibir stock.`);
          }
        }
        if (
          plan.action === "IN" &&
          plan.lot.expirationDate &&
          plan.lot.expirationDate < options.today
        ) {
          errors.push(`El lote ${plan.lot.lotCode} está vencido (${plan.lot.expirationDate}).`);
        }
        if (plan.lot.isNew && plan.action === "IN") {
          warnings.push(`Se crea el lote nuevo ${plan.lot.lotCode}.`);
        }
        if (hasOtherLots) {
          warnings.push("El producto tiene otros lotes con saldo en esta sucursal: no se modifican.");
        }
      }

      if (plan.action === "OUT") {
        warnings.push(`El stock baja de ${formatQuantity(plan.before)} a ${formatQuantity(target)}.`);
      }

      plan.movementStockBefore = roundQuantity(branchStock);
      plan.movementStockAfter = roundQuantity(branchStock + plan.delta);
      if (plan.action !== "NONE" && errors.length === 0) {
        if (plan.movementStockAfter < 0) {
          errors.push(
            `El stock de la sucursal quedaría negativo (${formatQuantity(plan.movementStockAfter)}): revisa lotes y movimientos.`
          );
        } else {
          runningStock.set(branchKey, plan.movementStockAfter);
        }
      }

      return plan;
    });

  const summary = {
    total: plans.length,
    in: plans.filter((plan) => plan.action === "IN").length,
    out: plans.filter((plan) => plan.action === "OUT").length,
    unchanged: plans.filter((plan) => plan.action === "NONE" && plan.errors.length === 0).length,
    withErrors: plans.filter((plan) => plan.errors.length > 0).length,
    withWarnings: plans.filter((plan) => plan.warnings.length > 0).length,
    quantityIn: roundQuantity(
      plans.filter((plan) => plan.action === "IN").reduce((sum, plan) => sum + plan.delta, 0)
    ),
    quantityOut: roundQuantity(
      plans.filter((plan) => plan.action === "OUT").reduce((sum, plan) => sum - plan.delta, 0)
    ),
  };

  return {
    rows: plans,
    summary,
    canCommit: summary.withErrors === 0 && summary.total > 0,
  };
}
