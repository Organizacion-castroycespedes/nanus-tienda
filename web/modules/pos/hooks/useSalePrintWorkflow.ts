"use client";

import { useCallback, useState } from "react";
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
import {
  ELECTRONIC_DOCUMENT_STATUSES,
  type ElectronicInvoicePrintDataset,
} from "../../reporteria/types";
import type { ToastVariant } from "../../../components/design-system/Toast";

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
  const { setPdfConfig, setIsBillingProcessing } = options;

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
    try {
      await requestElectronicBilling(saleId);

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const data = await getElectronicInvoicePrintData(saleId);
          if (
            data &&
            (data.status === ELECTRONIC_DOCUMENT_STATUSES.ACCEPTED ||
              data.status === ELECTRONIC_DOCUMENT_STATUSES.REJECTED ||
              data.status === ELECTRONIC_DOCUMENT_STATUSES.TECHNICAL_ERROR)
          ) {
            invoiceData = data;
            break;
          }
        } catch {
          // Keep polling
        }
        await new Promise((res) => setTimeout(res, 1200));
      }
    } catch (err) {
      console.error("Error al procesar facturación electrónica:", err);
    } finally {
      setIsBillingProcessing(false);
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

  const closePdfModal = useCallback(() => {
    setPdfConfig(null);
  }, []);

  const triggerPrintWorkflow = useCallback(
    async (params: ExecuteSalePrintWorkflowParams) => {
      await executeSalePrintWorkflow(params, {
        setPdfConfig,
        setIsBillingProcessing,
      });
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
