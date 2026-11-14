"use client";

import { Check, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import type { PosCartSerial } from "../../../store/posCart";
import { listAvailableSerials } from "../../inventory/services/product-serial.service";
import {
  findScannedSerial,
  formatPosSerialLabel,
  togglePosSerial,
  type PosSerialReservation,
} from "../utils/pos-serials";

type PosSerialPickerDialogProps = {
  productId: string;
  productName: string;
  branchId: string;
  /** Máximo seleccionable (stock disponible del producto). */
  max: number;
  initialSerials: PosCartSerial[];
  /** Series del producto que ya están en otra cuenta de este POS (no seleccionables). */
  reservedElsewhere?: PosSerialReservation[];
  /** Mensaje al reabrir tras un rechazo del API (serie vendida por otra caja). */
  notice?: string | null;
  onConfirm: (serials: PosCartSerial[]) => void;
  onCancel: () => void;
};

const PAGE_SIZE = 200;

const getErrorMessage = (error: unknown) =>
  error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : "No se pudieron cargar las series disponibles.";

/** Selector de series al vender: búsqueda, escáner (Enter) y lista con casillas. */
export const PosSerialPickerDialog = ({
  productId,
  productName,
  branchId,
  max,
  initialSerials,
  reservedElsewhere = [],
  notice,
  onConfirm,
  onCancel,
}: PosSerialPickerDialogProps) => {
  const [available, setAvailable] = useState<PosCartSerial[]>([]);
  const [selected, setSelected] = useState<PosCartSerial[]>(initialSerials);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(notice ?? null);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listAvailableSerials({ productId, branchId, limit: PAGE_SIZE });
      const items = (response.items ?? []).map((item) => ({
        id: item.id,
        serialNumber: item.serialNumber,
        locationCode: item.locationCode ?? null,
      }));
      setAvailable(items);
      // Las ya elegidas que dejaron de estar disponibles se quitan de la selección.
      const availableIds = new Set(items.map((item) => item.id));
      setSelected((current) => current.filter((serial) => availableIds.has(serial.id)));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [branchId, productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reservedById = useMemo(
    () => new Map(reservedElsewhere.map((reservation) => [reservation.id, reservation.accountName])),
    [reservedElsewhere]
  );
  const freeCount = available.filter((serial) => !reservedById.has(serial.id)).length;

  // Una serie elegida aquí que ya quedó en otra cuenta se quita de la selección.
  useEffect(() => {
    setSelected((current) => {
      const next = current.filter((serial) => !reservedById.has(serial.id));
      return next.length === current.length ? current : next;
    });
  }, [reservedById]);
  const limit = Math.max(Math.floor(max), 0);
  const selectedIds = useMemo(() => new Set(selected.map((serial) => serial.id)), [selected]);
  const filtered = useMemo(() => {
    const term = search.trim().toUpperCase();
    return term ? available.filter((serial) => serial.serialNumber.includes(term)) : available;
  }, [available, search]);

  const toggle = (serial: PosCartSerial) => {
    const reservedIn = reservedById.get(serial.id);
    if (reservedIn) {
      setMessage(`La serie ${serial.serialNumber} ya está en ${reservedIn}.`);
      return;
    }
    setSelected((current) => {
      const next = togglePosSerial(current, serial, limit);
      if (next.length === current.length && !current.some((item) => item.id === serial.id)) {
        setMessage(`Solo hay ${limit} unidades disponibles para vender.`);
      }
      return next;
    });
  };

  const handleSearchKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const code = search.trim().toUpperCase();
    if (!code) {
      return;
    }
    let scanned = findScannedSerial(available, code);
    if (!scanned && available.length >= PAGE_SIZE) {
      // La lista muestra las primeras 200: se busca la serie exacta en el servidor.
      try {
        const response = await listAvailableSerials({ productId, branchId, search: code, limit: 10 });
        const match = (response.items ?? []).find((item) => item.serialNumber === code);
        if (match) {
          scanned = { id: match.id, serialNumber: match.serialNumber, locationCode: match.locationCode ?? null };
          const found = scanned;
          setAvailable((current) => (current.some((item) => item.id === found.id) ? current : [found, ...current]));
        }
      } catch (searchError) {
        setError(getErrorMessage(searchError));
        return;
      }
    }
    if (!scanned) {
      setMessage(`La serie ${code} no está disponible en esta sucursal.`);
      return;
    }
    if (!selectedIds.has(scanned.id)) {
      toggle(scanned);
    }
    setMessage(null);
    setSearch("");
  };

  return (
    <Modal title="Seleccionar series" description={productName} onClose={onCancel} size="lg">
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200" aria-live="polite">
            {selected.length} {selected.length === 1 ? "serie seleccionada" : "series seleccionadas"}
          </p>
          <p className="text-xs text-slate-500">
            {freeCount} disponibles
            {available.length > freeCount ? ` · ${available.length - freeCount} en otra cuenta` : ""}
          </p>
        </div>

        <Input
          ref={searchRef}
          label="Buscar o escanear serie"
          autoFocus
          value={search}
          hint="Escanea la serie o escríbela y presiona Enter para agregarla."
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => void handleSearchKeyDown(event)}
        />

        {message ? <p className="text-sm text-amber-700">{message}</p> : null}
        {error ? (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Cargando series…
          </p>
        ) : filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500">
            {available.length === 0 ? "No hay series disponibles de este producto en la sucursal." : "Ninguna serie coincide."}
          </p>
        ) : (
          <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
            {filtered.map((serial) => {
              const isSelected = selectedIds.has(serial.id);
              const reservedIn = reservedById.get(serial.id);
              return (
                <li key={serial.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-disabled={Boolean(reservedIn)}
                    onClick={() => toggle(serial)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                      reservedIn
                        ? "cursor-not-allowed opacity-50"
                        : isSelected
                          ? "bg-blue-50 dark:bg-blue-500/10"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="font-mono text-slate-800 dark:text-slate-100">{formatPosSerialLabel(serial)}</span>
                    {reservedIn ? (
                      <span className="text-[11px] font-semibold text-amber-700">En {reservedIn}</span>
                    ) : isSelected ? (
                      <Check className="h-4 w-4 text-blue-600" aria-hidden="true" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(selected)} disabled={loading || selected.length === 0}>
            Agregar {selected.length > 0 ? selected.length : ""} al carrito
          </Button>
        </div>
      </div>
    </Modal>
  );
};
