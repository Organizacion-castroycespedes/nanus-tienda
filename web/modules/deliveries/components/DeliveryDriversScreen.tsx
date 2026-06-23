"use client";

import {
  ArrowLeft,
  Ban,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Users,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { Textarea } from "../../../components/design-system/Textarea";
import { Toast, type ToastVariant } from "../../../components/design-system/Toast";
import { useAutoClearState } from "../../../lib/useAutoClearState";
import { useAppSelector } from "../../../store/hooks";
import { getApiErrorMessage } from "../../reporteria/utils";
import {
  canManageDeliveryDrivers,
  canReadDeliveries,
  findDeliveryPermission,
} from "../delivery-permissions";
import {
  createDeliveryDriver,
  deactivateDeliveryDriver,
  listDeliveryDrivers,
  updateDeliveryDriver,
} from "../services/delivery-drivers.service";
import {
  type DeliveryDriver,
  type CreateDeliveryDriverPayload,
} from "../types";

type DriverForm = {
  name: string;
  phone: string;
  documentNumber: string;
  active: boolean;
  notes: string;
};

const emptyForm: DriverForm = {
  name: "",
  phone: "",
  documentNumber: "",
  active: true,
  notes: "",
};

const getParamValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const optionalText = (value: string) => {
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const buildPayload = (form: DriverForm): CreateDeliveryDriverPayload => ({
  name: form.name.trim(),
  phone: optionalText(form.phone),
  document_number: optionalText(form.documentNumber),
  active: form.active,
  notes: optionalText(form.notes),
});

export const DeliveryDriversScreen = () => {
  const router = useRouter();
  const params = useParams<{ tenant?: string | string[] }>();
  const role = (
    useAppSelector((state) => state.auth.user?.role ?? state.auth.role ?? "") ?? ""
  )
    .trim()
    .toUpperCase();
  const permissionsLoaded = useAppSelector(
    (state) => state.auth.permissionsLoaded
  );
  const authPermissions = useAppSelector((state) => state.auth.permissions);
  const authTenantId = useAppSelector(
    (state) => state.auth.user?.tenantId ?? state.auth.tenantId
  );
  const tenantSlug =
    getParamValue(params?.tenant) ??
    authTenantId ??
    "default";
  const deliveryPermission = useMemo(
    () => findDeliveryPermission(authPermissions),
    [authPermissions]
  );
  const canView = canReadDeliveries(deliveryPermission, role);
  const canManage = canManageDeliveryDrivers(deliveryPermission, role);

  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<ToastVariant>("success");
  const [editingDriver, setEditingDriver] = useState<DeliveryDriver | null>(null);
  const [form, setForm] = useState<DriverForm>(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useAutoClearState(toastMessage, setToastMessage);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    setToastMessage(message);
    setToastVariant(variant);
  }, []);

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await listDeliveryDrivers();
      setDrivers(response);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "No se pudieron cargar los repartidores.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!permissionsLoaded || !canView) {
      return;
    }
    void loadDrivers();
  }, [canView, loadDrivers, permissionsLoaded]);

  const openCreate = () => {
    if (!canManage) {
      return;
    }
    setEditingDriver(null);
    setForm(emptyForm);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEdit = (driver: DeliveryDriver) => {
    if (!canManage) {
      return;
    }
    setEditingDriver(driver);
    setForm({
      name: driver.name,
      phone: driver.phone ?? "",
      documentNumber: driver.document_number ?? "",
      active: driver.active,
      notes: driver.notes ?? "",
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (saving) {
      return;
    }
    setIsFormOpen(false);
    setEditingDriver(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const submitForm = async () => {
    if (!canManage) {
      setFormError("No tienes permisos para gestionar repartidores.");
      return;
    }
    if (!form.name.trim()) {
      setFormError("Nombre es requerido.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      if (editingDriver) {
        await updateDeliveryDriver(editingDriver.id, buildPayload(form));
        showToast("Repartidor actualizado.", "success");
      } else {
        await createDeliveryDriver(buildPayload(form));
        showToast("Repartidor creado.", "success");
      }
      setIsFormOpen(false);
      setEditingDriver(null);
      setForm(emptyForm);
      setFormError(null);
      await loadDrivers();
    } catch (error) {
      setFormError(
        getApiErrorMessage(error, "No se pudo guardar el repartidor.")
      );
    } finally {
      setSaving(false);
    }
  };

  const deactivateDriver = async (driver: DeliveryDriver) => {
    if (!canManage) {
      showToast("No tienes permisos para gestionar repartidores.", "error");
      return;
    }
    setSaving(true);
    try {
      await deactivateDeliveryDriver(driver.id);
      showToast("Repartidor desactivado.", "success");
      await loadDrivers();
    } catch (error) {
      showToast(
        getApiErrorMessage(error, "No se pudo desactivar el repartidor."),
        "error"
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

  if (!canView) {
    return (
      <section className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
        No tienes acceso a Repartidores.
      </section>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 space-y-6 overflow-x-hidden">
      {isFormOpen ? (
        <Modal
          title={editingDriver ? "Editar repartidor" : "Crear repartidor"}
          description="Catalogo logistico. No registra pagos ni caja."
          onClose={saving ? undefined : closeForm}
          footer={
            <>
              <Button variant="outline" onClick={closeForm} disabled={saving}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={submitForm} isLoading={saving}>
                <Save className="h-4 w-4" />
                Guardar
              </Button>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Nombre"
              required
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
            />
            <Input
              label="Telefono"
              value={form.phone}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, phone: event.target.value }))
              }
            />
            <Input
              label="Documento"
              value={form.documentNumber}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  documentNumber: event.target.value,
                }))
              }
            />
            <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, active: event.target.checked }))
                }
              />
              Activo
            </label>
            <div className="sm:col-span-2">
              <Textarea
                label="Notas"
                rows={3}
                value={form.notes}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, notes: event.target.value }))
                }
              />
            </div>
            {formError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 sm:col-span-2">
                {formError}
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {toastMessage ? <Toast message={toastMessage} variant={toastVariant} /> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Domicilios
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">
              Repartidores
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Catalogo logistico por tenant. No toca caja, pagos, POS ni fiscal.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              variant="outline"
              onClick={() => router.push(`/${tenantSlug}/deliveries`)}
              className="w-full sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Domicilios
            </Button>
            <Button
              variant="ghost"
              onClick={() => void loadDrivers()}
              isLoading={loading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            <Button
              onClick={openCreate}
              className="w-full sm:w-auto"
              disabled={!canManage}
              title={
                canManage
                  ? undefined
                  : "Solo ADMIN, SUPER_USER o SUPER_ADMIN pueden crear repartidores"
              }
            >
              <Plus className="h-4 w-4" />
              Crear repartidor
            </Button>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
          {errorMessage}
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Listado de repartidores
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {drivers.length} registros.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            <Users className="h-4 w-4" />
            Catalogo
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[780px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Telefono</th>
                <th className="px-4 py-3 font-medium">Documento</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Notas</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Cargando repartidores...
                  </td>
                </tr>
              ) : drivers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No hay repartidores para mostrar.
                  </td>
                </tr>
              ) : (
                drivers.map((driver) => (
                  <tr key={driver.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {driver.name}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {driver.phone || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {driver.document_number || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          driver.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {driver.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="max-w-[240px] truncate">
                        {driver.notes || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(driver)}
                            disabled={saving}
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => void deactivateDriver(driver)}
                            disabled={saving || !driver.active}
                          >
                            <Ban className="h-4 w-4" />
                            Desactivar
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Solo lectura</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
