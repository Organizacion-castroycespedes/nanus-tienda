"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PARAMETER_CODES,
  PARAMETER_MODES,
  type ParameterMode,
  resolveTenantSettings,
} from "../../../domains/parameters/api";
import {
  getElectronicInvoice,
  getElectronicInvoicePrintData,
  getPosSaleTicket,
  getPosSaleTicketPrintData,
} from "../../reporteria/services/reporting.service";
import { printReporteriaSaleTicket } from "../../reporteria/direct-print";
import { printElectronicInvoiceTicket } from "../../reporteria/electronic-invoice-direct-print";
import { requestElectronicBilling } from "../../reporteria/services/electronic-billing.service";
import { refreshOperationalSaleBillingStatus } from "../../operational-sales/services/operational-sales.service";
import {
  ELECTRONIC_DOCUMENT_STATUSES,
  type ElectronicInvoicePrintDataset,
} from "../../reporteria/types";
import type { ToastVariant } from "../../../components/design-system/Toast";
import { ApiError } from "../../../lib/request";

const ELECTRONIC_INVOICE_POLL_INTERVAL_MS = 3_000;
const ELECTRONIC_INVOICE_MAX_ATTEMPTS = 41;
const ELECTRONIC_INVOICE_TERMINAL_STATUSES = new Set<
  ElectronicInvoicePrintDataset["status"]
>([
  ELECTRONIC_DOCUMENT_STATUSES.ACCEPTED,
  ELECTRONIC_DOCUMENT_STATUSES.REJECTED,
  ELECTRONIC_DOCUMENT_STATUSES.TECHNICAL_ERROR,
  ELECTRONIC_DOCUMENT_STATUSES.CANCELLED,
]);

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

const abortError = () => {
  const error = new Error("Electronic invoice polling aborted");
  error.name = "AbortError";
  return error;
};

const waitForDelay = (delayMs: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const handleAbort = () => {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleAbort);
      reject(abortError());
    };
    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, delayMs);
    signal?.addEventListener("abort", handleAbort, { once: true });
  });

export type ElectronicInvoicePollingDependencies = {
  loadInvoice: (
    saleId: string,
    signal?: AbortSignal,
  ) => Promise<ElectronicInvoicePrintDataset>;
  refreshStatus: (saleId: string, signal?: AbortSignal) => Promise<unknown>;
  wait: (delayMs: number, signal?: AbortSignal) => Promise<void>;
};

export const waitForElectronicInvoice = async (
  saleId: string,
  options: {
    signal?: AbortSignal;
    maxAttempts?: number;
    intervalMs?: number;
  } = {},
  dependencies: ElectronicInvoicePollingDependencies = {
    loadInvoice: getElectronicInvoicePrintData,
    refreshStatus: refreshOperationalSaleBillingStatus,
    wait: waitForDelay,
  },
) => {
  const maxAttempts = options.maxAttempts ?? ELECTRONIC_INVOICE_MAX_ATTEMPTS;
  const intervalMs = options.intervalMs ?? ELECTRONIC_INVOICE_POLL_INTERVAL_MS;
  let refreshAttempted = false;
  let latestInvoice: ElectronicInvoicePrintDataset | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (options.signal?.aborted) {
      throw abortError();
    }

    try {
      latestInvoice = await dependencies.loadInvoice(saleId, options.signal);
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }
    }

    if (
      latestInvoice &&
      ELECTRONIC_INVOICE_TERMINAL_STATUSES.has(latestInvoice.status)
    ) {
      return latestInvoice;
    }

    if (
      latestInvoice?.status === ELECTRONIC_DOCUMENT_STATUSES.PROCESSING &&
      !refreshAttempted
    ) {
      refreshAttempted = true;
      try {
        await dependencies.refreshStatus(saleId, options.signal);
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
        // Background reconciliation remains active. Continue bounded polling.
      }
      continue;
    }

    if (attempt < maxAttempts - 1) {
      await dependencies.wait(intervalMs, options.signal);
    }
  }

  return latestInvoice;
};

export type PdfPreviewConfig = {
  title: string;
  fileName: string;
  getPdf: () => Promise<Blob>;
  description?: string;
  allowPrint?: boolean;
};

export type ExecuteSalePrintWorkflowParams = {
  saleId: string;
  tenantId?: string | null;
  branchId?: string | null;
  terminalId?: string | null;
  electronicBillingEnabled?: boolean;
  showToast?: (
    message: string,
    variant: ToastVariant
  ) => void;
};

export const executeSalePrintWorkflow = async (
  params: ExecuteSalePrintWorkflowParams,
  options: {
    setPdfConfig: (config: PdfPreviewConfig | null) => void;
    setIsBillingProcessing: (isProcessing: boolean) => void;
    signal?: AbortSignal;
  }
) => {
  const {
    saleId,
    tenantId,
    branchId,
    terminalId,
    electronicBillingEnabled = true,
    showToast,
  } = params;
  const { setPdfConfig, setIsBillingProcessing, signal } = options;

  let printTicketMode: ParameterMode = PARAMETER_MODES.ON_DEMAND;
  let printInvoiceMode: ParameterMode = PARAMETER_MODES.ON_DEMAND;

  if (tenantId) {
    try {
      const [ticketRes, invoiceRes] = await Promise.allSettled([
        resolveTenantSettings({
          tenantId,
          branchId: branchId ?? undefined,
          terminalId: terminalId ?? undefined,
          code: PARAMETER_CODES.PRINT_TICKET,
        }),
        resolveTenantSettings({
          tenantId,
          branchId: branchId ?? undefined,
          terminalId: terminalId ?? undefined,
          code: PARAMETER_CODES.PRINT_INVOICE,
        }),
      ]);
      if (ticketRes.status === "fulfilled" && ticketRes.value?.value) {
        printTicketMode = ticketRes.value.value as ParameterMode;
      }
      if (invoiceRes.status === "fulfilled" && invoiceRes.value?.value) {
        printInvoiceMode = invoiceRes.value.value as ParameterMode;
      }
    } catch {
      // Keep default ON_DEMAND
    }
  }

  const isElectronicBillingActive =
    electronicBillingEnabled !== false &&
    printInvoiceMode !== PARAMETER_MODES.DISABLED;

  if (isElectronicBillingActive) {
    setIsBillingProcessing(true);
    let invoiceData: ElectronicInvoicePrintDataset | null = null;
    let cancelled = false;
    try {
      const request = await requestElectronicBilling(saleId);
      if (!["REQUESTED", "DOCUMENT_EXISTS"].includes(request.result)) {
        throw new Error(
          request.reason ?? "La venta no es elegible para facturación electrónica.",
        );
      }
      invoiceData = await waitForElectronicInvoice(saleId, { signal });
    } catch (err) {
      cancelled = isAbortError(err);
      if (!cancelled) {
        console.error("Error al procesar facturación electrónica:", err);
      }
    } finally {
      setIsBillingProcessing(false);
    }

    if (cancelled) {
      return;
    }

    if (invoiceData?.status === ELECTRONIC_DOCUMENT_STATUSES.ACCEPTED) {
      if (printInvoiceMode === PARAMETER_MODES.ON_DEMAND) {
        setPdfConfig({
          title: `Factura electrónica ${saleId.slice(0, 8)}`,
          fileName: `factura-electronica-${saleId}.pdf`,
          getPdf: () => getElectronicInvoice(saleId),
          description: "Vista previa de la Factura Electrónica",
          allowPrint: true,
        });
      } else if (printInvoiceMode === PARAMETER_MODES.AUTOMATIC) {
        try {
          const ticketPrintData = await getPosSaleTicketPrintData(saleId);
          await printElectronicInvoiceTicket(
            invoiceData,
            ticketPrintData,
            { tenantId, branchId, terminalId }
          );
          showToast?.("Factura electrónica enviada a la impresora.", "success");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Error de impresora";
          setPdfConfig({
            title: `Factura electrónica ${saleId.slice(0, 8)}`,
            fileName: `factura-electronica-${saleId}.pdf`,
            getPdf: () => getElectronicInvoice(saleId),
            description: `No se pudo imprimir automáticamente: ${message}. Puedes imprimir manualmente.`,
            allowPrint: true,
          });
          showToast?.(
            "Error al imprimir automáticamente la factura.",
            "warning"
          );
        }
      }
    } else {
      showToast?.(
        "La venta se guardó, pero la factura electrónica no fue emitida de inmediato.",
        "warning"
      );
      if (printTicketMode === PARAMETER_MODES.ON_DEMAND) {
        setPdfConfig({
          title: `Ticket de venta ${saleId.slice(0, 8)}`,
          fileName: `ticket-venta-${saleId}.pdf`,
          getPdf: () => getPosSaleTicket(saleId),
          description:
            "Facturación pendiente. Vista previa del Ticket de Venta.",
          allowPrint: true,
        });
      } else if (printTicketMode === PARAMETER_MODES.AUTOMATIC) {
        try {
          const ticketPrintData = await getPosSaleTicketPrintData(saleId);
          await printReporteriaSaleTicket(
            ticketPrintData,
            {
              tenantId,
              branchId,
              terminalId,
            }
          );
          showToast?.("Ticket enviado a la impresora.", "success");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Error de impresora";
          setPdfConfig({
            title: `Ticket de venta ${saleId.slice(0, 8)}`,
            fileName: `ticket-venta-${saleId}.pdf`,
            getPdf: () => getPosSaleTicket(saleId),
            description: `No se pudo imprimir automáticamente: ${message}. Puedes imprimir manualmente.`,
            allowPrint: true,
          });
          showToast?.(
            "Error al imprimir automáticamente el ticket.",
            "warning"
          );
        }
      }
    }
  } else {
    // Standard ticket flow
    if (printTicketMode === PARAMETER_MODES.ON_DEMAND) {
      setPdfConfig({
        title: `Ticket de venta ${saleId.slice(0, 8)}`,
        fileName: `ticket-venta-${saleId}.pdf`,
        getPdf: () => getPosSaleTicket(saleId),
        description: "Vista previa del Ticket de Venta",
        allowPrint: true,
      });
    } else if (printTicketMode === PARAMETER_MODES.AUTOMATIC) {
      try {
        const ticketPrintData = await getPosSaleTicketPrintData(saleId);
        await printReporteriaSaleTicket(ticketPrintData, {
          tenantId,
          branchId,
          terminalId,
        });
        showToast?.("Ticket enviado a la impresora.", "success");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error de impresora";
        setPdfConfig({
          title: `Ticket de venta ${saleId.slice(0, 8)}`,
          fileName: `ticket-venta-${saleId}.pdf`,
          getPdf: () => getPosSaleTicket(saleId),
          description: `No se pudo imprimir automáticamente: ${message}. Puedes imprimir manualmente.`,
          allowPrint: true,
        });
        showToast?.(
          "Error al imprimir automáticamente el ticket.",
          "warning"
        );
      }
    }
  }
};

export const useSalePrintWorkflow = () => {
  const [pdfConfig, setPdfConfig] = useState<PdfPreviewConfig | null>(null);
  const [isBillingProcessing, setIsBillingProcessing] = useState(false);
  const activeWorkflowRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    activeWorkflowRef.current?.abort();
  }, []);

  const closePdfModal = useCallback(() => {
    setPdfConfig(null);
  }, []);

  const triggerPrintWorkflow = useCallback(
    async (params: ExecuteSalePrintWorkflowParams) => {
      activeWorkflowRef.current?.abort();
      const controller = new AbortController();
      activeWorkflowRef.current = controller;
      await executeSalePrintWorkflow(params, {
        setPdfConfig: (config) => {
          if (activeWorkflowRef.current === controller) {
            setPdfConfig(config);
          }
        },
        setIsBillingProcessing: (isProcessing) => {
          if (activeWorkflowRef.current === controller) {
            setIsBillingProcessing(isProcessing);
          }
        },
        signal: controller.signal,
      });
      if (activeWorkflowRef.current === controller) {
        activeWorkflowRef.current = null;
      }
    },
    []
  );

  return {
    pdfConfig,
    isBillingProcessing,
    closePdfModal,
    triggerPrintWorkflow,
  };
};
