"use client";

import React, { memo } from "react";
import { Scale, Search } from "lucide-react";
import { Button } from "../../../../components/design-system/Button";
import { Input } from "../../../../components/design-system/Input";
import type { ProductResponse } from "../../../../domains/products/dtos";

export type ScannerMockStatus = "disabled" | "connected" | "error";
export type ScaleMockStatus = "disabled" | "ready" | "reading" | "error";
export type ScaleConfigState = "loading" | "unconfigured" | "configured" | "error";

export type PosDiagnosticsPanelProps = {
  scannerMockStatus: ScannerMockStatus;
  scannerMockEnabled: boolean;
  scannerMockCode: string;
  setScannerMockCode: (code: string) => void;
  scannerSimulating: boolean;
  onSimulateScannerRead: () => void;
  scannerLastCode: string | null;
  scannerLastResult: string | null;
  scaleMockStatus: ScaleMockStatus;
  scaleMockEnabled: boolean;
  scaleConfigState: ScaleConfigState;
  firstWeighableCartProduct: ProductResponse | null;
  scaleLastWeight: string | null;
  scaleLastResult: string | null;
  scaleReading: boolean;
  onReadScaleFromCart: () => void;
};

export const PosDiagnosticsPanel = memo(function PosDiagnosticsPanel({
  scannerMockStatus,
  scannerMockEnabled,
  scannerMockCode,
  setScannerMockCode,
  scannerSimulating,
  onSimulateScannerRead,
  scannerLastCode,
  scannerLastResult,
  scaleMockStatus,
  scaleMockEnabled,
  scaleConfigState,
  firstWeighableCartProduct,
  scaleLastWeight,
  scaleLastResult,
  scaleReading,
  onReadScaleFromCart,
}: PosDiagnosticsPanelProps) {
  return (
    <>
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/70">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Scanner
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                  scannerMockStatus === "connected"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
                    : scannerMockStatus === "error"
                      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
                      : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                }`}
              >
                {scannerMockEnabled
                  ? scannerMockStatus === "error"
                    ? "Desconectado"
                    : "Escuchando scanner.code.read"
                  : "Desactivado por feature flag"}
              </span>
            </div>
            <Input
              label="Código scanner"
              placeholder="SKU, codigo de barras o referencia"
              value={scannerMockCode}
              onChange={(event) => setScannerMockCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSimulateScannerRead();
                }
              }}
              disabled={!scannerMockEnabled}
              className="dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <Button
            variant="outline"
            size="md"
            isLoading={scannerSimulating}
            disabled={!scannerMockEnabled || !scannerMockCode.trim()}
            onClick={onSimulateScannerRead}
            className="xl:mb-0.5"
          >
            <Search className="h-4 w-4" />
            Simular scanner
          </Button>
        </div>
        {scannerLastCode || scannerLastResult ? (
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
            {scannerLastCode ? <span>Ultimo codigo: {scannerLastCode}</span> : null}
            {scannerLastResult ? <span>{scannerLastResult}</span> : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/70">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                <Scale className="h-4 w-4" />
                Balanza
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                  scaleMockStatus === "ready"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
                    : scaleMockStatus === "reading"
                      ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100"
                      : scaleMockStatus === "error"
                        ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"
                        : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                }`}
              >
                {scaleMockEnabled
                  ? scaleMockStatus === "reading"
                    ? "Leyendo"
                    : scaleMockStatus === "error"
                      ? "Error"
                      : "Listo"
                  : scaleConfigState === "loading"
                    ? "Verificando configuración"
                    : scaleConfigState === "error"
                      ? "Configuración no disponible"
                      : scaleConfigState === "configured"
                        ? "Pendiente: balanza REAL no autorizada"
                        : "Sin balanza configurada"}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
              <span>
                Producto pesable:{" "}
                {firstWeighableCartProduct?.name ?? "ninguno en carrito"}
              </span>
              {scaleLastWeight ? <span>Ultimo peso: {scaleLastWeight}</span> : null}
              {scaleLastResult ? <span>{scaleLastResult}</span> : null}
            </div>
          </div>
          <Button
            variant="outline"
            size="md"
            isLoading={scaleReading}
            disabled={!scaleMockEnabled || scaleReading}
            onClick={onReadScaleFromCart}
            className="xl:mb-0.5"
          >
            <Scale className="h-4 w-4" />
            Leer balanza
          </Button>
        </div>
      </div>
    </>
  );
});
