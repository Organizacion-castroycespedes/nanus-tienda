"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "../../../components/design-system/Button";
import { getApiErrorMessage } from "../../reporteria/utils";
import { useAppSelector } from "../../../store/hooks";
import {
  canCreateDelivery,
  findDeliveryPermission,
} from "../delivery-permissions";
import { createDelivery } from "../services/deliveries.service";
import type { CreateDeliveryPayload } from "../types";
import { CreateDeliveryForm } from "./CreateDeliveryForm";

const getParamValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const CreateDeliveryScreen = () => {
  const router = useRouter();
  const params = useParams<{ tenant?: string | string[] }>();
  const authTenantId = useAppSelector(
    (state) => state.auth.user?.tenantId ?? state.auth.tenantId
  );
  const tenantSlug =
    getParamValue(params?.tenant) ??
    authTenantId ??
    "default";
  const role = (
    useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? "") ?? ""
  )
    .trim()
    .toUpperCase();
  const permissionsLoaded = useAppSelector(
    (state) => state.auth.permissionsLoaded
  );
  const authPermissions = useAppSelector((state) => state.auth.permissions);
  const deliveryPermission = useMemo(
    () => findDeliveryPermission(authPermissions),
    [authPermissions]
  );
  const canCreate = canCreateDelivery(deliveryPermission, role);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const goBack = () => router.push(`/${tenantSlug}/deliveries`);

  const handleSubmit = async (payload: CreateDeliveryPayload) => {
    setSaving(true);
    setErrorMessage(null);
    try {
      await createDelivery(payload);
      goBack();
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "No se pudo crear el domicilio.")
      );
    } finally {
      setSaving(false);
    }
  };

  if (!permissionsLoaded) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Cargando permisos...
      </section>
    );
  }

  if (!canCreate) {
    return (
      <section className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
        <p>No tienes permiso para crear domicilios.</p>
        <Button variant="outline" onClick={goBack} className="mt-4">
          Volver al listado
        </Button>
      </section>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 space-y-4 overflow-x-hidden">
      {errorMessage ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMessage}
        </section>
      ) : null}

      <CreateDeliveryForm
        isSaving={saving}
        onCancel={goBack}
        onSubmit={(payload) => void handleSubmit(payload)}
      />
    </div>
  );
};
