"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ProductResponse } from "../../../domains/products/dtos";
import { resolveInventoryBarcode } from "../../inventory/barcode/barcode-resolver";
import { InventoryProductSearchResults } from "../../inventory/barcode/InventoryProductSearchResults";
import { InventoryScanBar } from "../../inventory/barcode/InventoryScanBar";
import { searchInventoryProducts } from "../../inventory/barcode/inventory-product-search";
import {
  createInventoryScanFeedback,
  createInventoryScanSoundPlayer,
  inventoryScanMessages,
  type InventoryScanFeedback,
  type InventoryScanTone,
} from "../../inventory/barcode/inventory-scan-feedback";
import { useInventoryBarcodeCapture } from "../../inventory/barcode/use-inventory-barcode-capture";
import {
  resolveLineAmounts,
  type QuotationDraftLine,
  type QuotationLinePricing,
} from "../hooks/use-quotation-line-pricing";
import { formatQuotationMoney, formatQuotationQuantity } from "../quotation-format";
import { addOrIncrementLine } from "../quotation-lines";

export { addOrIncrementLine, createDraftLine } from "../quotation-lines";

type Props = {
  lines: QuotationDraftLine[];
  products: ProductResponse[];
  pricing: Record<string, QuotationLinePricing>;
  readOnly?: boolean;
  disabledReason?: string | null;
  /** true mientras otro control del formulario (p. ej. el buscador de clientes) necesita el foco. */
  scanReleased?: boolean;
  onChange: (lines: QuotationDraftLine[]) => void;
};

const headerCell = "border-r border-slate-600 px-3 py-2";

/**
 * Tabla estilo hoja de calculo (portada de flexibuild) con la captura por lector de Pedidos y Compras
 * (HU-SCAN-001): el foco vuelve a la barra despues de cada lectura, escanear de nuevo un producto
 * suma 1 y una lectura que cae en una cantidad se procesa como escaneo sin cambiar esa cantidad.
 */
export const QuotationItemsTable = ({
  lines,
  products,
  pricing,
  readOnly = false,
  disabledReason,
  scanReleased = false,
  onChange,
}: Props) => {
  const [feedback, setFeedback] = useState<InventoryScanFeedback | null>(null);
  const [candidates, setCandidates] = useState<ProductResponse[] | null>(null);
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const sounds = useMemo(() => createInventoryScanSoundPlayer(), []);
  const canEdit = !readOnly && !disabledReason;

  const notify = useCallback(
    (tone: InventoryScanTone, message: string) => {
      setFeedback(createInventoryScanFeedback(tone, message));
      if (tone === "success") {
        sounds.success();
      } else if (tone === "error" || tone === "warning") {
        sounds.error();
      }
    },
    [sounds]
  );

  const addProduct = useCallback(
    (product: ProductResponse) => {
      const result = addOrIncrementLine(linesRef.current, product);
      linesRef.current = result.lines;
      onChange(result.lines);
      setCandidates(null);
      notify("success", inventoryScanMessages.added(product.name, result.line.quantity));
    },
    [notify, onChange]
  );

  const handleScan = useCallback(
    (code: string) => {
      const resolution = resolveInventoryBarcode(code, products);
      switch (resolution.kind) {
        case "MATCH":
          addProduct(resolution.product);
          return;
        case "AMBIGUOUS":
          setCandidates(resolution.candidates);
          notify("warning", inventoryScanMessages.ambiguous(resolution.code, resolution.candidates.length));
          return;
        case "PRESENTATION_UNSUPPORTED":
          setCandidates(null);
          notify("error", inventoryScanMessages.presentationUnsupported(resolution.code));
          return;
        default:
          setCandidates(null);
          notify("error", inventoryScanMessages.notFound(resolution.code));
      }
    },
    [addProduct, notify, products]
  );

  const capture = useInventoryBarcodeCapture({
    enabled: canEdit,
    focusReleased: scanReleased,
    onScan: handleScan,
    onDuplicateIgnored: (code) => notify("info", inventoryScanMessages.duplicateIgnored(code)),
    // Un codigo leido con el foco en una cantidad se procesa como escaneo y la cantidad no cambia.
    fieldScanScope: scopeRef,
    onFieldScan: (code) => {
      handleScan(code);
      return true;
    },
    onManualSubmit: (query) => {
      const exact = resolveInventoryBarcode(query, products);
      if (exact.kind !== "NOT_FOUND") {
        handleScan(query);
        capture.clear();
        return;
      }
      const results = searchInventoryProducts(products, query);
      if (results.length === 1) {
        addProduct(results[0]);
        capture.clear();
        return;
      }
      notify("warning", results.length === 0 ? `Sin resultados para "${query}".` : "Elige un producto de la lista.");
    },
  });

  const searchResults = useMemo(
    () => (candidates ? [] : searchInventoryProducts(products, capture.query)),
    [candidates, capture.query, products]
  );

  const selectFromList = (product: ProductResponse) => {
    capture.clear();
    addProduct(product);
    capture.focusScanInput();
  };

  const updateQuantity = (index: number, raw: string) => {
    const quantity = Number(raw.replace(",", "."));
    onChange(lines.map((line, current) => (current === index ? { ...line, quantity: Number.isFinite(quantity) ? quantity : 0 } : line)));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= lines.length) {
      return;
    }
    const next = [...lines];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChange(next);
  };

  return (
    <div ref={scopeRef} className="space-y-3">
      {canEdit ? (
        <div className="max-w-2xl">
          <InventoryScanBar
            id="quotation-scan"
            capture={capture}
            feedback={feedback}
            label="Escanear o buscar producto"
            placeholder="Escanea un código o escribe nombre, SKU o código"
          >
            {candidates ? (
              <InventoryProductSearchResults
                title="Elige el producto del código ambiguo"
                products={candidates}
                onSelect={selectFromList}
              />
            ) : capture.query.trim().length >= 2 ? (
              <InventoryProductSearchResults
                title="Productos del catálogo"
                products={searchResults}
                emptyMessage="Sin resultados. Revisa el nombre, SKU o código."
                onSelect={selectFromList}
                renderMeta={(product) => formatQuotationMoney(Number(product.price) || 0)}
              />
            ) : null}
          </InventoryScanBar>
        </div>
      ) : disabledReason && !readOnly ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          {disabledReason}
        </p>
      ) : null}

      <div className="overflow-x-auto border border-slate-400 bg-white dark:border-slate-600 dark:bg-slate-900">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-800 text-xs uppercase tracking-wide text-white">
            <tr>
              <th className={`${headerCell} w-10 text-center`}>#</th>
              <th className={`${headerCell} w-28 text-left`}>Código</th>
              <th className={`${headerCell} min-w-[260px] text-left`}>Producto</th>
              <th className={`${headerCell} w-16 text-center`}>Und.</th>
              <th className={`${headerCell} w-28 text-right`}>Cantidad</th>
              <th className={`${headerCell} w-32 text-right`}>Precio</th>
              <th className={`${headerCell} w-20 text-right`}>Desc.</th>
              <th className={`${headerCell} w-28 text-right`}>IVA</th>
              <th className={`${headerCell} w-36 text-right`}>Total</th>
              {canEdit ? <th className="w-28 px-3 py-2 text-center">Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 10 : 9} className="px-3 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  Agrega productos del catálogo para armar la cotización.
                </td>
              </tr>
            ) : (
              lines.map((line, index) => {
                const amounts = resolveLineAmounts(line, pricing[line.key], readOnly);
                const linePricing = pricing[line.key];
                const invalidQuantity =
                  !(line.quantity > 0) || (!line.allowsDecimal && !Number.isInteger(line.quantity));
                return (
                  <tr
                    key={line.key}
                    className={`border-b border-slate-300 dark:border-slate-700 ${index % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50 dark:bg-slate-800/60"}`}
                  >
                    <td className="border-r border-slate-300 px-2 py-2 text-center text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300">
                      {index + 1}
                    </td>
                    <td className="border-r border-slate-300 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
                      {line.productCode ?? "-"}
                    </td>
                    <td className="border-r border-slate-300 px-3 py-2 dark:border-slate-700">
                      <p className="font-medium text-slate-900 dark:text-white">{line.productName}</p>
                      {amounts.promotionName ? (
                        <p className="text-xs italic text-emerald-700 dark:text-emerald-300">Promoción: {amounts.promotionName}</p>
                      ) : null}
                      {linePricing?.status === "error" && !readOnly ? (
                        <p className="text-xs text-rose-600 dark:text-rose-300">{linePricing.message}</p>
                      ) : null}
                    </td>
                    <td className="border-r border-slate-300 px-3 py-2 text-center text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
                      {line.unitCode ?? "-"}
                    </td>
                    <td className="border-r border-slate-300 px-2 py-1 text-right dark:border-slate-700">
                      {canEdit ? (
                        <input
                          data-quotation-qty={index}
                          type="number"
                          inputMode="decimal"
                          min={line.allowsDecimal ? 0.01 : 1}
                          step={line.allowsDecimal ? 0.01 : 1}
                          value={Number.isFinite(line.quantity) ? line.quantity : ""}
                          aria-invalid={invalidQuantity}
                          aria-label={`Cantidad de ${line.productName}`}
                          onWheel={(event) => event.currentTarget.blur()}
                          onChange={(event) => updateQuantity(index, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              capture.focusScanInput();
                            }
                          }}
                          className={`w-24 rounded border px-2 py-1 text-right text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:bg-slate-800 dark:text-white ${invalidQuantity ? "border-rose-400" : "border-slate-300 dark:border-slate-600"} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                        />
                      ) : (
                        <span className="text-slate-900 dark:text-white">{formatQuotationQuantity(line.quantity)}</span>
                      )}
                    </td>
                    <td className="border-r border-slate-300 px-3 py-2 text-right text-slate-900 dark:border-slate-700 dark:text-white">
                      {formatQuotationMoney(amounts.unitPrice)}
                    </td>
                    <td className="border-r border-slate-300 px-3 py-2 text-right text-slate-700 dark:border-slate-700 dark:text-slate-300">
                      {amounts.discountPercent > 0 ? `${amounts.discountPercent}%` : "-"}
                    </td>
                    <td className="border-r border-slate-300 px-3 py-2 text-right text-slate-700 dark:border-slate-700 dark:text-slate-300">
                      {amounts.pending ? "…" : formatQuotationMoney(amounts.taxAmount)}
                    </td>
                    <td className="border-r border-slate-300 px-3 py-2 text-right font-semibold text-slate-900 dark:border-slate-700 dark:text-white">
                      {formatQuotationMoney(amounts.lineTotal)}
                      {amounts.pending && !readOnly ? <span className="block text-[10px] font-normal text-amber-600">precio de lista</span> : null}
                    </td>
                    {canEdit ? (
                      <td className="px-2 py-1">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" title="Subir" disabled={index === 0} onClick={() => move(index, -1)} className="rounded border border-slate-300 p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" title="Bajar" disabled={index === lines.length - 1} onClick={() => move(index, 1)} className="rounded border border-slate-300 p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" title="Quitar" onClick={() => onChange(lines.filter((_, current) => current !== index))} className="rounded border border-rose-200 p-1 text-rose-600 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {canEdit && lines.length > 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Escanear de nuevo un producto suma 1. Enter en una cantidad vuelve a la barra de escaneo (F2 también). Los precios se calculan con el motor de precios y se confirman al guardar.
        </p>
      ) : null}
    </div>
  );
};
