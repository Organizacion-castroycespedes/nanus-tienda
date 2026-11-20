"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Toast, type ToastVariant } from "../../../../components/design-system/Toast";
import { isConfirmCancelledError, useConfirm } from "../../../../hooks/use-confirm";
import { useAutoClearState } from "../../../../lib/useAutoClearState";
import { getApiErrorMessage } from "../../../../modules/reporteria/utils";
import { QuotationForm } from "../../../../modules/quotations/components/QuotationForm";
import { useQuotationPermissions } from "../../../../modules/quotations/hooks/use-quotation-permissions";
import { createQuotation, getQuotationSettings } from "../../../../modules/quotations/services/quotation.service";
import type { QuotationPayload } from "../../../../modules/quotations/types";

const NuevaCotizacionPage = () => {
  const params = useParams<{ tenant: string }>();
  const tenant = params?.tenant ?? "default";
  const router = useRouter();
  const permissions = useQuotationPermissions();
  const confirm = useConfirm();
  const [validityDays, setValidityDays] = useState(15);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  useAutoClearState(toastMessage, setToastMessage);

  useEffect(() => {
    if (permissions.view) {
      getQuotationSettings()
        .then((settings) => setValidityDays(settings.defaultValidityDays))
        .catch(() => undefined);
    }
  }, [permissions.view]);

  if (!permissions.create) {
    return permissions.ready ? (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        No tienes permisos para crear cotizaciones.
      </div>
    ) : null;
  }

  const handleCancel = async (hasChanges: boolean) => {
    if (hasChanges) {
      try {
        await confirm({
          title: "Descartar cotización",
          description: "Los datos que ingresaste no se guardarán.",
          confirmText: "Descartar",
          cancelText: "Seguir editando",
          variant: "warning",
        });
      } catch (error) {
        if (isConfirmCancelledError(error)) {
          return;
        }
        throw error;
      }
    }
    router.push(`/${tenant}/quotations`);
  };

  const handleSubmit = async (payload: QuotationPayload) => {
    setSaving(true);
    try {
      const created = await createQuotation(payload);
      router.push(`/${tenant}/quotations/${created.id}`);
    } catch (error) {
      setToastMessage(getApiErrorMessage(error, "No se pudo crear la cotización."));
      setToastVariant("error");
      setSaving(false);
    }
  };

  return (
    <>
      <QuotationForm
        title="Nueva cotización"
        defaultValidityDays={validityDays}
        submitLabel="Guardar cotización"
        saving={saving}
        onSubmit={handleSubmit}
        onCancel={(hasChanges) => void handleCancel(hasChanges)}
        onValidationError={(message) => {
          setToastMessage(message);
          setToastVariant("warning");
        }}
      />
      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}
    </>
  );
};

export default NuevaCotizacionPage;
