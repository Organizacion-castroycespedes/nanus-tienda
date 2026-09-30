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
import {
  describeElectronicBillingFailure,
  requestElectronicBilling,
  type ElectronicBillingOnlineResult,
  type ElectronicBillingRequestResult,
} from "../../reporteria/services/electronic-billing.service";
import {
  ELECTRONIC_DOCUMENT_STATUSES,
  type ElectronicInvoicePrintDataset,
} from "../../reporteria/types";
import type { ToastVariant } from "../../../components/design-system/Toast";
import { ApiError } from "../../../lib/request";

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

const abortError = () => {
  const error = new Error("Electronic billing workflow aborted");
  error.name = "AbortError";
  return error;
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw abortError();
  }
};

const onlineResult = (
  status: ElectronicBillingOnlineResult["status"],
  overrides: Partial<ElectronicBillingOnlineResult> = {},
): ElectronicBillingOnlineResult => ({
  status,
  electronicDocumentId: null,
  documentType: "INVOICE",
  fullNumber: null,
  cufe: null,
  cude: null,
  failureClass: null,
  errorCode: null,
  errorMessage: null,
  failures: [],
  message: "",
  ...overrides,
});

const fromRequestResult = (
  request: ElectronicBillingRequestResult,
): ElectronicBillingOnlineResult | null => {
  if (request.electronicBilling) {
    return request.electronicBilling;
  }
  if (request.result === "DOCUMENT_EXISTS") {
    return null;
  }
  if (request.result !== "REQUESTED") {
    const message = request.reason ?? "La venta no es elegible para facturación electrónica.";
    return onlineResult("REJECTED", {
      failureClass: "VALIDATION",
      errorCode: request.result,
      errorMessage: message,
      message,
    });
  }
  return onlineResult("PROCESSING", {
    message: "El documento electrónico se sigue procesando. Consulte el estado en unos minutos.",
  });
};

export type ElectronicBillingResolutionDependencies = {
  request: (saleId: string) => Promise<ElectronicBillingRequestResult>;
  loadInvoice: (
    saleId: string,
    signal?: AbortSignal,
  ) => Promise<ElectronicInvoicePrintDataset>;
};

export type ElectronicBillingResolution = {
  online: ElectronicBillingOnlineResult;
  invoice: ElectronicInvoicePrintDataset | null;
};

/**
 * Resolves the fiscal result without polling: the API already waited for the
 * provider answer. Only an ACCEPTED document needs one read of the print data.
 */
export const resolveElectronicBillingOutcome = async (
  saleId: string,
  initial: ElectronicBillingOnlineResult | null | undefined,
  options: { signal?: AbortSignal } = {},
  dependencies: ElectronicBillingResolutionDependencies = {
    request: requestElectronicBilling,
    loadInvoice: getElectronicInvoicePrintData,
  },
): Promise<ElectronicBillingResolution> => {
  throwIfAborted(options.signal);
  let online = initial ?? null;
  let documentExists = false;
  if (!online) {
    const request = await dependencies.request(saleId);
    throwIfAborted(options.signal);
    online = fromRequestResult(request);
    documentExists = request.result === "DOCUMENT_EXISTS" && !online;
  }

  if (online && online.status !== "ACCEPTED") {
    return { online, invoice: null };
  }

  let invoice: ElectronicInvoicePrintDataset | null = null;
  try {
    invoice = await dependencies.loadInvoice(saleId, options.signal);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (!(error instanceof ApiError) || error.status !== 404) {
      console.error("Error al cargar la factura electrónica aceptada:", error);
    }
  }
  throwIfAborted(options.signal);

  if (online) {
    return { online, invoice };
  }
  if (documentExists && invoice?.status === ELECTRONIC_DOCUMENT_STATUSES.ACCEPTED) {
    return {
      online: onlineResult("ACCEPTED", {
        electronicDocumentId: invoice.electronicDocumentId,
        fullNumber: invoice.documentNumber,
        cufe: invoice.cufe,
        message: "Factura electrónica aceptada por la DIAN.",
      }),
      invoice,
    };
  }
  return {
    online: onlineResult("PROCESSING", {
      message: "El documento electrónico se sigue procesando. Consulte el estado en unos minutos.",
    }),
    invoice: null,
  };
};

export const buildElectronicBillingNotice = (
  online: ElectronicBillingOnlineResult,
): { message: string; variant: ToastVariant } | null => {
  if (online.status === "ACCEPTED") {
    return null;
  }
  if (online.status === "REJECTED") {
    const failure = describeElectronicBillingFailure(online);
    return {
      message: `La venta se guardó, pero la factura electrónica fue rechazada. ${failure.text}`.trim(),
      variant: "error",
    };
  }
  if (online.status === "QUEUED_NETWORK") {
    return {
      message:
        "La venta se guardó. Sin conexión con facturación electrónica: la factura quedó en cola y se enviará automáticamente.",
      variant: "warning",
    };
  }
  return {
    message:
      "La venta se guardó. La factura electrónica sigue en proceso con la DIAN; consulte el estado en unos minutos.",
    variant: "warning",
  };
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
  electronicBillingMode?: "AUTOMATIC" | "ON_DEMAND";
  electronicBilling?: ElectronicBillingOnlineResult | null;
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
    electronicBillingMode,
    electronicBilling,
    showToast,
  } = params;
  const { setPdfConfig, setIsBillingProcessing, signal } = options;

  let printTicketMode: ParameterMode = PARAMETER_MODES.ON_DEMAND;
  let printInvoiceMode: ParameterMode = PARAMETER_MODES.ON_DEMAND;
  let generateInvoiceMode: ParameterMode =
    electronicBillingMode === PARAMETER_MODES.ON_DEMAND
      ? PARAMETER_MODES.ON_DEMAND
      : PARAMETER_MODES.AUTOMATIC;
  let sendInvoiceMode: ParameterMode = PARAMETER_MODES.AUTOMATIC;

  if (tenantId) {
    try {
      const resolved = await resolveTenantSettings({
        tenantId,
        branchId: branchId ?? undefined,
        terminalId: terminalId ?? undefined,
      });
      const values = resolved?.values ?? {};
      if (values[PARAMETER_CODES.PRINT_TICKET]) {
        printTicketMode = values[PARAMETER_CODES.PRINT_TICKET] as ParameterMode;
      }
      if (values[PARAMETER_CODES.PRINT_INVOICE]) {
        printInvoiceMode = values[PARAMETER_CODES.PRINT_INVOICE] as ParameterMode;
      }
      if (values[PARAMETER_CODES.GENERATE_INVOICE]) {
        generateInvoiceMode = values[PARAMETER_CODES.GENERATE_INVOICE] as ParameterMode;
      }
      if (values[PARAMETER_CODES.SEND_INVOICE]) {
        sendInvoiceMode = values[PARAMETER_CODES.SEND_INVOICE] as ParameterMode;
      }
    } catch {
      // Keep defaults
    }
  }

  const isElectronicBillingActive =
    electronicBillingEnabled !== false &&
    generateInvoiceMode === PARAMETER_MODES.AUTOMATIC &&
    sendInvoiceMode !== PARAMETER_MODES.DISABLED &&
    printInvoiceMode !== PARAMETER_MODES.DISABLED;

  if (isElectronicBillingActive) {
    setIsBillingProcessing(true);
    let resolution: ElectronicBillingResolution | null = null;
    let cancelled = false;
    try {
      resolution = await resolveElectronicBillingOutcome(saleId, electronicBilling, { signal });
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

    const invoiceData = resolution?.invoice ?? null;
    if (resolution?.online.status === "ACCEPTED") {
      if (printInvoiceMode === PARAMETER_MODES.ON_DEMAND || !invoiceData) {
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
      const notice = resolution
        ? buildElectronicBillingNotice(resolution.online)
        : {
            message: "La venta se guardó, pero la factura electrónica no fue emitida de inmediato.",
            variant: "warning" as ToastVariant,
          };
      if (notice) {
        showToast?.(notice.message, notice.variant);
      }
      if (printTicketMode === PARAMETER_MODES.ON_DEMAND) {
        setPdfConfig({
          title: `Ticket de venta ${saleId.slice(0, 8)}`,
          fileName: `ticket-venta-${saleId}.pdf`,
          getPdf: () => getPosSaleTicket(saleId),
          description: notice?.message ?? "Facturación pendiente. Vista previa del Ticket de Venta.",
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

  const cancelBillingProcessing = useCallback(() => {
    const activeWorkflow = activeWorkflowRef.current;
    activeWorkflowRef.current = null;
    activeWorkflow?.abort();
    setIsBillingProcessing(false);
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
    cancelBillingProcessing,
    closePdfModal,
    triggerPrintWorkflow,
  };
};
