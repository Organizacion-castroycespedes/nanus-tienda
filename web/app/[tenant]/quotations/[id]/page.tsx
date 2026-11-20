"use client";

import { ArrowLeft, CheckCircle2, Copy, FileDown, Mail, RefreshCcw, ShoppingCart, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../../components/design-system/Button";
import { Toast, type ToastVariant } from "../../../../components/design-system/Toast";
import { isConfirmCancelledError, useConfirm } from "../../../../hooks/use-confirm";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import { PdfPreviewModal } from "../../../../modules/reporteria/components/PdfPreviewModal";
import { getApiErrorMessage } from "../../../../modules/reporteria/utils";
import {
  QuotationConvertDialog,
  QuotationEmailDialog,
  QuotationRejectDialog,
} from "../../../../modules/quotations/components/QuotationDialogs";
import { QuotationForm } from "../../../../modules/quotations/components/QuotationForm";
import { QuotationStatusBadge } from "../../../../modules/quotations/components/QuotationStatusBadge";
import { useQuotationPermissions } from "../../../../modules/quotations/hooks/use-quotation-permissions";
import { formatQuotationDate, formatQuotationMoney } from "../../../../modules/quotations/quotation-format";
import { resolveQuotationActions } from "../../../../modules/quotations/quotation-permissions";
import {
  approveQuotation,
  convertQuotationToOrder,
  duplicateQuotation,
  getQuotation,
  getQuotationPdf,
  rejectQuotation,
  renewQuotation,
  sendQuotationEmail,
  updateQuotation,
} from "../../../../modules/quotations/services/quotation.service";
import type { QuotationDetail, QuotationPayload } from "../../../../modules/quotations/types";

type BusyAction = "save" | "send" | "approve" | "reject" | "renew" | "duplicate" | "convert" | null;

const CotizacionDetallePage = () => {
  const params = useParams<{ tenant: string; id: string }>();
  const tenant = params?.tenant ?? "default";
  const quotationId = params?.id ?? "";
  const router = useRouter();
  const confirm = useConfirm();
  const permissions = useQuotationPermissions();
  const [detail, setDetail] = useState<QuotationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  useAutoClearState(toastMessage, setToastMessage);

  const notify = (message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  };

  const load = useCallback(async () => {
    if (!quotationId) {
      return;
    }
    setLoading(true);
    try {
      setDetail(await getQuotation(quotationId));
    } catch (error) {
      notify(getApiErrorMessage(error, "No se pudo cargar la cotización."), "error");
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => {
    if (permissions.view) {
      void load();
    }
  }, [load, permissions.view]);

  const askConfirm = async (title: string, description: string, confirmText: string) => {
    try {
      await confirm({ title, description, confirmText });
      return true;
    } catch (error) {
      if (isConfirmCancelledError(error)) {
        return false;
      }
      throw error;
    }
  };

  const run = async (action: Exclude<BusyAction, null>, work: () => Promise<QuotationDetail>, success: string) => {
    setBusy(action);
    try {
      setDetail(await work());
      notify(success, "success");
    } catch (error) {
      notify(getApiErrorMessage(error, "No se pudo completar la acción."), "error");
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (!permissions.view) {
    return permissions.ready ? (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        No tienes permisos para consultar esta cotización.
      </div>
    ) : null;
  }

  if (loading && !detail) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        Cargando cotización...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        <p>No se encontró la cotización.</p>
        <Link href={`/${tenant}/quotations`} className="font-semibold text-blue-700 dark:text-blue-300">
          Volver a cotizaciones
        </Link>
        {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}
      </div>
    );
  }

  const actions = resolveQuotationActions(detail.effectiveStatus, detail.status, permissions);

  const headerAside = (
    <>
      <QuotationStatusBadge status={detail.effectiveStatus} />
      <Link href={`/${tenant}/quotations`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
      </Link>
    </>
  );

  const handleSave = async (payload: QuotationPayload) => {
    await run("save", () => updateQuotation(detail.id, payload), "Cotización actualizada con precios recalculados.");
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {detail.effectiveStatus === "EXPIRED" ? (
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Venció el {formatQuotationDate(detail.validUntil)}. Renuévala para actualizar precios y vigencia.
            </span>
          ) : detail.effectiveStatus === "APPROVED" ? (
            <span>
              Aprobada · precios congelados hasta el <strong>{formatQuotationDate(detail.validUntil)}</strong>.
            </span>
          ) : detail.effectiveStatus === "CONVERTED" ? (
            <span>Convertida en pedido el {formatQuotationDate(detail.convertedAt)}.</span>
          ) : (
            <span>Vigente hasta el {formatQuotationDate(detail.validUntil)}.</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setPdfOpen(true)}>
            <FileDown className="h-4 w-4" />
            PDF
          </Button>
          {actions.send ? (
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => setEmailOpen(true)}>
              <Mail className="h-4 w-4" />
              Enviar por correo
            </Button>
          ) : null}
          {actions.approve ? (
            <Button
              size="sm"
              disabled={busy !== null}
              isLoading={busy === "approve"}
              onClick={async () => {
                if (await askConfirm("Aprobar cotización", "Los precios quedan congelados y la cotización ya no se puede editar.", "Aprobar")) {
                  await run("approve", () => approveQuotation(detail.id), "Cotización aprobada.");
                }
              }}
            >
              <CheckCircle2 className="h-4 w-4" />
              Aprobar
            </Button>
          ) : null}
          {actions.convert ? (
            <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => setConvertOpen(true)}>
              <ShoppingCart className="h-4 w-4" />
              Convertir a pedido
            </Button>
          ) : null}
          {actions.renew ? (
            <Button
              size="sm"
              variant="warning"
              disabled={busy !== null}
              isLoading={busy === "renew"}
              onClick={async () => {
                if (await askConfirm("Renovar cotización", "Se recalculan los precios con el motor actual y se abre una nueva vigencia en borrador.", "Renovar")) {
                  await run("renew", () => renewQuotation(detail.id), "Cotización renovada con precios actuales.");
                }
              }}
            >
              <RefreshCcw className="h-4 w-4" />
              Renovar
            </Button>
          ) : null}
          {actions.duplicate ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy !== null}
              isLoading={busy === "duplicate"}
              onClick={async () => {
                if (await askConfirm("Duplicar cotización", "Se crea una nueva cotización en borrador con precios actuales.", "Duplicar")) {
                  setBusy("duplicate");
                  try {
                    const copy = await duplicateQuotation(detail.id);
                    router.push(`/${tenant}/quotations/${copy.id}`);
                  } catch (error) {
                    notify(getApiErrorMessage(error, "No se pudo duplicar la cotización."), "error");
                    setBusy(null);
                  }
                }
              }}
            >
              <Copy className="h-4 w-4" />
              Duplicar
            </Button>
          ) : null}
          {actions.reject ? (
            <Button size="sm" variant="danger" disabled={busy !== null} onClick={() => setRejectOpen(true)}>
              <XCircle className="h-4 w-4" />
              Rechazar
            </Button>
          ) : null}
        </div>
      </section>

      {detail.order ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-sm text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100">
          <span>
            Pedido generado · {formatQuotationMoney(detail.order.total)} · estado {detail.order.status}
          </span>
          <Link href={`/${tenant}/orders`} className="font-semibold underline">
            Ir a pedidos
          </Link>
        </section>
      ) : null}

      <QuotationForm
        title={`Cotización ${detail.code}`}
        detail={detail}
        readOnly={!actions.edit}
        defaultValidityDays={detail.validityDays}
        submitLabel="Guardar cambios"
        saving={busy === "save"}
        headerAside={headerAside}
        onSubmit={actions.edit ? handleSave : undefined}
        onValidationError={(message) => notify(message, "warning")}
      />

      <PdfPreviewModal
        isOpen={pdfOpen}
        title={`Cotización ${detail.code}`}
        fileName={`cotizacion-${detail.code}.pdf`}
        description="Vista previa de la cotización"
        allowPrint
        onClose={() => setPdfOpen(false)}
        getPdf={() => getQuotationPdf(detail.id)}
      />

      {rejectOpen ? (
        <QuotationRejectDialog
          code={detail.code}
          busy={busy === "reject"}
          onCancel={() => setRejectOpen(false)}
          onConfirm={async (reason) => {
            await run("reject", () => rejectQuotation(detail.id, reason), "Cotización rechazada.");
            setRejectOpen(false);
          }}
        />
      ) : null}

      {emailOpen ? (
        <QuotationEmailDialog
          code={detail.code}
          customerName={detail.customerName}
          customerEmail={detail.customerEmail}
          busy={busy === "send"}
          onCancel={() => setEmailOpen(false)}
          onConfirm={async (payload) => {
            setBusy("send");
            try {
              const result = await sendQuotationEmail(detail.id, payload);
              setDetail(result.quotation);
              setEmailOpen(false);
              notify(`Cotización enviada a ${result.to}.`, "success");
            } catch (error) {
              notify(getApiErrorMessage(error, "No se pudo enviar el correo."), "error");
              await load();
            } finally {
              setBusy(null);
            }
          }}
        />
      ) : null}

      {convertOpen ? (
        <QuotationConvertDialog
          code={detail.code}
          total={detail.total}
          validUntil={detail.validUntil}
          customerName={detail.customerName}
          busy={busy === "convert"}
          onCancel={() => setConvertOpen(false)}
          onConfirm={async (type) => {
            setBusy("convert");
            try {
              const result = await convertQuotationToOrder(detail.id, type);
              setDetail(result.quotation);
              setConvertOpen(false);
              notify("Pedido creado en borrador con los precios cotizados.", "success");
            } catch (error) {
              notify(getApiErrorMessage(error, "No se pudo convertir la cotización."), "error");
              await load();
            } finally {
              setBusy(null);
            }
          }}
        />
      ) : null}

      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}
    </div>
  );
};

export default CotizacionDetallePage;
