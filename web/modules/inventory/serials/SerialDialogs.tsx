"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../../../components/design-system/Button";
import { Modal } from "../../../components/design-system/Modal";
import { Select } from "../../../components/design-system/Select";
import { listInventoryLocations, type InventoryLocationResponse } from "../services/inventory-location.service";
import {
  getSerialHistory,
  inspectSerial,
  moveSerialsLocation,
  type ProductSerialDetail,
  type ProductSerialEvent,
} from "../services/product-serial.service";
import {
  allowedInspectionResults,
  INSPECTION_RESULT_LABELS,
  serialEventLabel,
  serialReferenceLabel,
  serialStatusLabel,
  type SerialInspectionResult,
} from "./serial-labels";

const getErrorMessage = (error: unknown, fallback: string) =>
  error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : fallback;

const formatDateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
    : "-";

const ReasonField = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
  <div className="grid gap-2">
    <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="serial-reason">
      Motivo <span className="text-red-600">*</span>
    </label>
    <textarea
      id="serial-reason"
      rows={3}
      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
    <span className="text-xs text-slate-500">Mínimo 5 caracteres. Queda en el historial de la serie.</span>
  </div>
);

/** Historial de eventos de una serie (inmutable). */
export const SerialHistoryModal = ({ serialId, onClose }: { serialId: string; onClose: () => void }) => {
  const [data, setData] = useState<{ serial: ProductSerialDetail; events: ProductSerialEvent[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getSerialHistory(serialId)
      .then((result) => mounted && setData(result))
      .catch((loadError) => mounted && setError(getErrorMessage(loadError, "No se pudo cargar el historial.")));
    return () => {
      mounted = false;
    };
  }, [serialId]);

  return (
    <Modal
      title={data ? `Serie ${data.serial.serialNumber}` : "Historial de la serie"}
      description={data ? `${data.serial.productName ?? ""} · ${serialStatusLabel(data.serial.status)}` : undefined}
      onClose={onClose}
      size="lg"
    >
      {error ? (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      ) : !data ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando historial…
        </p>
      ) : data.events.length === 0 ? (
        <p className="text-sm text-slate-500">Sin eventos registrados.</p>
      ) : (
        <ol className="grid gap-3">
          {data.events.map((event) => (
            <li key={event.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-slate-900 dark:text-white">{serialEventLabel(event.eventType)}</span>
                <span className="text-xs text-slate-500">{formatDateTime(event.createdAt)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {event.fromStatus ? `${serialStatusLabel(event.fromStatus)} → ` : ""}
                {event.toStatus ? serialStatusLabel(event.toStatus) : ""}
                {event.referenceType ? ` · ${serialReferenceLabel(event.referenceType)}` : ""}
                {event.referenceId ? ` ${event.referenceId.slice(0, 8)}` : ""}
                {event.fromLocationCode || event.toLocationCode
                  ? ` · Ubicación ${event.fromLocationCode ?? "-"} → ${event.toLocationCode ?? "-"}`
                  : ""}
              </p>
              {event.reason ? <p className="mt-1 text-xs italic text-slate-500">“{event.reason}”</p> : null}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
};

/** Inspección de una serie devuelta o bloqueada, o bloqueo de una disponible. */
export const SerialInspectDialog = ({
  serial,
  onClose,
  onDone,
}: {
  serial: ProductSerialDetail;
  onClose: () => void;
  onDone: (message: string) => void;
}) => {
  const options = allowedInspectionResults(serial.status);
  const [result, setResult] = useState<SerialInspectionResult | "">(options[0] ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!result) return;
    if (reason.trim().length < 5) {
      setError("Indica un motivo de al menos 5 caracteres.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await inspectSerial(serial.id, { result, reason: reason.trim() });
      onDone(`Serie ${serial.serialNumber}: ${INSPECTION_RESULT_LABELS[result].toLowerCase()}.`);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "No se pudo registrar la inspección."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Inspeccionar ${serial.serialNumber}`}
      description={`${serial.productName ?? ""} · ${serialStatusLabel(serial.status)}`}
      onClose={onClose}
    >
      <div className="grid gap-4">
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">Resultado</legend>
          {options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="radio"
                name="serial-inspection"
                value={option}
                checked={result === option}
                onChange={() => setResult(option)}
              />
              {INSPECTION_RESULT_LABELS[option]}
            </label>
          ))}
        </fieldset>
        <ReasonField value={reason} onChange={setReason} />
        {error ? (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} isLoading={busy} disabled={!result}>
            Confirmar
          </Button>
        </div>
      </div>
    </Modal>
  );
};

/** Mueve una o varias series de la misma sucursal a otra ubicación. */
export const SerialMoveDialog = ({
  serials,
  onClose,
  onDone,
}: {
  serials: ProductSerialDetail[];
  onClose: () => void;
  onDone: (message: string) => void;
}) => {
  const branchIds = [...new Set(serials.map((serial) => serial.branchId))];
  const branchId = branchIds.length === 1 ? branchIds[0] : null;
  const [locations, setLocations] = useState<InventoryLocationResponse[]>([]);
  const [locationId, setLocationId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    branchId ? null : "Selecciona series de una sola sucursal para moverlas."
  );

  useEffect(() => {
    if (!branchId) return;
    let mounted = true;
    listInventoryLocations({ branchId, isActive: true })
      .then((result) => mounted && setLocations(result))
      .catch(() => mounted && setError("No se pudieron cargar las ubicaciones."));
    return () => {
      mounted = false;
    };
  }, [branchId]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await moveSerialsLocation({
        serialIds: serials.map((serial) => serial.id),
        locationId: locationId || null,
        reason: reason.trim() || undefined,
      });
      onDone(`${result.moved} ${result.moved === 1 ? "serie movida" : "series movidas"}.`);
    } catch (submitError) {
      setError(getErrorMessage(submitError, "No se pudo mover la ubicación."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Mover ubicación"
      description={`${serials.length} ${serials.length === 1 ? "serie" : "series"}: ${serials
        .slice(0, 5)
        .map((serial) => serial.serialNumber)
        .join(", ")}${serials.length > 5 ? "…" : ""}`}
      onClose={onClose}
    >
      <div className="grid gap-4">
        <Select
          label="Nueva ubicación"
          value={locationId}
          disabled={!branchId}
          onChange={(event) => setLocationId(event.target.value)}
        >
          <option value="">Sin ubicación</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.code} - {location.name}
            </option>
          ))}
        </Select>
        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="serial-move-reason">
            Motivo (opcional)
          </label>
          <textarea
            id="serial-move-reason"
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <p className="text-xs text-slate-500">No crea movimientos de inventario: solo cambia dónde está guardada.</p>
        {error ? (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} isLoading={busy} disabled={!branchId}>
            Mover
          </Button>
        </div>
      </div>
    </Modal>
  );
};
