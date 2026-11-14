"use client";

import { X } from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";

import { Button } from "../../../components/design-system/Button";
import { Input } from "../../../components/design-system/Input";
import { Modal } from "../../../components/design-system/Modal";
import { parseSerialFile, validateSerials, type SerialPrevalidationResponse } from "../services/product-serial.service";
import { addSerials, formatSerialProgress, parseSerialText, removeSerial, type AddSerialsResult } from "./serial-capture";

type SerialCaptureDialogProps = {
  productId: string;
  productName: string;
  branchId: string;
  /** Unidades a recibir en la línea: deben capturarse exactamente estas series. */
  expected: number;
  initialSerials: string[];
  /** Series ya capturadas en otras líneas del mismo producto. */
  takenElsewhere?: string[];
  onSave: (serials: string[]) => void;
  onCancel: () => void;
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : fallback;

const describeAddResult = (result: AddSerialsResult) => {
  const parts: string[] = [];
  if (result.invalid.length > 0) {
    parts.push(`Formato no válido: ${result.invalid.slice(0, 5).join(", ")}${result.invalid.length > 5 ? "…" : ""}.`);
  }
  if (result.duplicates.length > 0) {
    parts.push(`Repetidas: ${result.duplicates.slice(0, 5).join(", ")}${result.duplicates.length > 5 ? "…" : ""}.`);
  }
  if (result.overflow.length > 0) {
    parts.push(`${result.overflow.length} no se agregaron porque superan la cantidad a recibir.`);
  }
  return parts.join(" ");
};

/** Captura de series para una línea de recepción: escáner, pegado, archivo y prevalidación. */
export const SerialCaptureDialog = ({
  productId,
  productName,
  branchId,
  expected,
  initialSerials,
  takenElsewhere = [],
  onSave,
  onCancel,
}: SerialCaptureDialogProps) => {
  const [serials, setSerials] = useState<string[]>(initialSerials);
  const [scanValue, setScanValue] = useState("");
  const [pasteValue, setPasteValue] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<SerialPrevalidationResponse | null>(null);
  const [acknowledgedWarning, setAcknowledgedWarning] = useState(false);
  const [busy, setBusy] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const complete = serials.length === expected;

  const resetValidation = () => {
    setValidation(null);
    setAcknowledgedWarning(false);
    setError(null);
  };

  const add = (incoming: string[]) => {
    const result = addSerials(serials, incoming, expected, takenElsewhere);
    if (result.added.length > 0) {
      setSerials(result.serials);
      resetValidation();
    }
    setNotice(describeAddResult(result) || null);
    return result;
  };

  const handleScanKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (scanValue.trim()) {
      add([scanValue]);
    }
    setScanValue("");
  };

  const handlePaste = () => {
    const result = add(parseSerialText(pasteValue));
    if (result.added.length > 0 || result.duplicates.length > 0) {
      setPasteValue("");
    }
    scanRef.current?.focus();
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await parseSerialFile(file);
      const result = add(response.serialNumbers ?? []);
      if (result.added.length === 0 && !describeAddResult(result)) {
        setNotice("El archivo no tiene series.");
      }
    } catch (fileError) {
      setError(getErrorMessage(fileError, "No se pudo leer el archivo."));
    } finally {
      setBusy(false);
    }
  };

  const warnings = useMemo(() => validation?.existsInOtherProduct ?? [], [validation]);

  const handleSave = async () => {
    if (!complete) {
      setError(`Debes capturar ${formatSerialProgress(expected, expected)}; llevas ${serials.length}.`);
      return;
    }
    if (validation?.ok && (warnings.length === 0 || acknowledgedWarning)) {
      onSave(serials);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await validateSerials({ productId, branchId, serialNumbers: serials });
      setValidation(result);
      if (!result.ok) {
        const issues: string[] = [];
        if (result.alreadyRegistered.length > 0) {
          issues.push(
            `Ya registradas en este producto: ${result.alreadyRegistered.map((item) => item.serialNumber).join(", ")}.`
          );
        }
        if (result.invalidFormat.length > 0) {
          issues.push(`Formato no válido: ${result.invalidFormat.join(", ")}.`);
        }
        if (result.duplicatesInPayload.length > 0) {
          issues.push(`Repetidas: ${result.duplicatesInPayload.join(", ")}.`);
        }
        setError(issues.join(" ") || "Las series no son válidas.");
        return;
      }
      if (result.existsInOtherProduct.length === 0) {
        onSave(serials);
      }
    } catch (validationError) {
      setError(getErrorMessage(validationError, "No se pudieron validar las series."));
    } finally {
      setBusy(false);
    }
  };

  const confirmWithWarning = () => {
    setAcknowledgedWarning(true);
    onSave(serials);
  };

  return (
    <Modal title="Números de serie" description={productName} onClose={onCancel} size="lg">
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <p
            className={`text-sm font-semibold ${complete ? "text-emerald-700" : "text-slate-700 dark:text-slate-200"}`}
            aria-live="polite"
          >
            {formatSerialProgress(serials.length, expected)}
          </p>
          {serials.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSerials([]);
                resetValidation();
                setNotice(null);
              }}
            >
              Quitar todas
            </Button>
          ) : null}
        </div>

        <Input
          ref={scanRef}
          label="Escanear o escribir serie"
          autoFocus
          value={scanValue}
          disabled={complete}
          hint={complete ? "Ya capturaste todas las series." : "Presiona Enter para agregar."}
          onChange={(event) => setScanValue(event.target.value)}
          onKeyDown={handleScanKeyDown}
        />

        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="serial-paste">
            Pegar varias series (una por línea)
          </label>
          <textarea
            id="serial-paste"
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            value={pasteValue}
            disabled={complete}
            onChange={(event) => setPasteValue(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={complete || !pasteValue.trim()} onClick={handlePaste}>
              Agregar pegadas
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={complete || busy}
              onClick={() => fileRef.current?.click()}
            >
              Cargar archivo (.csv, .txt, .xlsx)
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.xlsx"
              className="hidden"
              aria-label="Archivo de series"
              onChange={handleFile}
            />
          </div>
        </div>

        {notice ? <p className="text-sm text-amber-700">{notice}</p> : null}

        {serials.length > 0 ? (
          <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
            {serials.map((serial, index) => (
              <li key={serial} className="flex items-center justify-between px-3 py-1.5 text-sm">
                <span className="font-mono text-slate-800 dark:text-slate-100">
                  <span className="mr-2 text-xs text-slate-400">{index + 1}.</span>
                  {serial}
                </span>
                <button
                  type="button"
                  aria-label={`Quitar serie ${serial}`}
                  className="flex h-7 w-7 items-center justify-center rounded text-rose-600 hover:bg-rose-50"
                  onClick={() => {
                    setSerials(removeSerial(serials, serial));
                    resetValidation();
                  }}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {validation?.ok && warnings.length > 0 ? (
          <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Estas series ya existen en otro producto (se permite, revisa que no sea un error):{" "}
            {warnings.map((item) => `${item.serialNumber} (${item.productSku || item.productName})`).join(", ")}.
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          {validation?.ok && warnings.length > 0 && !acknowledgedWarning ? (
            <Button onClick={confirmWithWarning}>Guardar de todas formas</Button>
          ) : (
            <Button onClick={handleSave} disabled={busy || !complete}>
              {busy ? "Validando…" : "Validar y guardar"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
