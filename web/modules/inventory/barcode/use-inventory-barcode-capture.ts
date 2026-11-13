import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";

import { createInventoryBarcodeDeduper } from "./barcode-deduper";
import {
  createInventoryBarcodeWedgeState,
  handleInventoryBarcodeKey,
  resolveInventoryBarcodeWedgeOptions,
} from "./barcode-wedge";

/**
 * Captura con lector HID en modo teclado para pedidos y compras (D1, D2, D4).
 * La detección corre solo en la barra de escaneo; el foco vuelve a ella salvo
 * con diálogos abiertos, edición de otros campos o navegación con Tab.
 */

export type UseInventoryBarcodeCaptureOptions = {
  enabled: boolean;
  /** true mientras un diálogo propio del formulario necesita el foco. */
  focusReleased?: boolean;
  autoFocus?: boolean;
  onScan: (code: string) => void;
  onManualSubmit?: (query: string) => void;
  onDuplicateIgnored?: (code: string) => void;
  /**
   * Contenedor (normalmente el formulario) cuyos campos de texto también se
   * vigilan: si el lector escribe en otro campo, se bloquea su Enter.
   */
  fieldScanScope?: RefObject<HTMLElement | null>;
  /**
   * Lectura del lector recibida en otro campo del contenedor. Devuelve true si
   * se procesó como escaneo (el campo recupera su valor anterior) o false para
   * conservar lo escrito (por ejemplo, un código de lote escaneado a propósito).
   */
  onFieldScan?: (code: string, field: HTMLInputElement | HTMLTextAreaElement) => boolean;
};

const FIELD_SCAN_INPUT_TYPES = new Set(["", "text", "search", "number", "tel"]);

const isFieldScanTarget = (
  element: EventTarget | null
): element is HTMLInputElement | HTMLTextAreaElement =>
  element instanceof HTMLTextAreaElement ||
  (element instanceof HTMLInputElement && FIELD_SCAN_INPUT_TYPES.has(element.type));

/** Cambia el valor de un input controlado por React y notifica su onChange. */
const restoreFieldValue = (field: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const prototype =
    field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
};

const OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [aria-modal="true"]';

const isEditableElement = (element: Element | null) =>
  element instanceof HTMLElement &&
  (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName));

const isInsideOverlay = (element: Element | null) => Boolean(element?.closest(OVERLAY_SELECTOR));

export const useInventoryBarcodeCapture = (options: UseInventoryBarcodeCaptureOptions) => {
  const { enabled, focusReleased = false, autoFocus = true } = options;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const wedgeStateRef = useRef(createInventoryBarcodeWedgeState());
  const deduperRef = useRef(createInventoryBarcodeDeduper());
  const wedgeOptions = useMemo(() => resolveInventoryBarcodeWedgeOptions(), []);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const focusScanInput = useCallback(() => {
    window.requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input || input.disabled) {
        return;
      }
      input.focus({ preventScroll: true });
      input.select();
    });
  }, []);

  const clear = useCallback(() => {
    setQuery("");
    wedgeStateRef.current = createInventoryBarcodeWedgeState();
  }, []);

  const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const current = optionsRef.current;
      if (!current.enabled) {
        return;
      }

      if (event.key === "Escape") {
        if (event.currentTarget.value) {
          event.preventDefault();
          clear();
        }
        return;
      }

      const result = handleInventoryBarcodeKey(
        wedgeStateRef.current,
        event.key,
        event.timeStamp,
        wedgeOptions
      );
      wedgeStateRef.current = result.nextState;
      if (!result.isTerminator) {
        return;
      }

      // Enter en la barra nunca envía el formulario contenedor.
      event.preventDefault();

      if (result.committedCode) {
        const code = result.committedCode;
        setQuery("");
        if (deduperRef.current.shouldProcess(code, event.timeStamp)) {
          current.onScan(code);
        } else {
          current.onDuplicateIgnored?.(code);
        }
        return;
      }

      const manualQuery = event.currentTarget.value.trim();
      if (manualQuery) {
        current.onManualSubmit?.(manualQuery);
      }
    },
    [clear, wedgeOptions]
  );

  useEffect(() => {
    if (!enabled || focusReleased) {
      return undefined;
    }

    let isKeyboardNavigation = false;
    let fieldWedge = createInventoryBarcodeWedgeState();
    let fieldTarget: HTMLInputElement | HTMLTextAreaElement | null = null;
    let fieldSnapshot = "";

    // Lecturas del lector que caen en otro campo del formulario (lote, costo, cantidad).
    const handleFieldKeyDown = (event: globalThis.KeyboardEvent) => {
      const scope = optionsRef.current.fieldScanScope?.current;
      const target = event.target;
      if (!scope || target === inputRef.current || !isFieldScanTarget(target) || !scope.contains(target)) {
        return;
      }
      if (fieldTarget !== target) {
        fieldTarget = target;
        fieldWedge = createInventoryBarcodeWedgeState();
      }
      const result = handleInventoryBarcodeKey(fieldWedge, event.key, event.timeStamp, wedgeOptions);
      if (!result.isTerminator && result.nextState.buffer.length === 1) {
        // keydown llega antes de escribir el carácter: este es el valor previo a la secuencia.
        fieldSnapshot = target.value;
      }
      fieldWedge = result.nextState;
      if (!result.committedCode) {
        return;
      }

      // Enter del lector nunca envía el formulario ni confirma el campo.
      event.preventDefault();
      event.stopPropagation();
      const code = result.committedCode;
      const snapshot = fieldSnapshot;
      fieldTarget = null;

      if (!deduperRef.current.shouldProcess(code, event.timeStamp)) {
        restoreFieldValue(target, snapshot);
        optionsRef.current.onDuplicateIgnored?.(code);
        return;
      }
      if (optionsRef.current.onFieldScan?.(code, target)) {
        restoreFieldValue(target, snapshot);
        focusScanInput();
      }
    };

    const restoreFocus = () => {
      if (isKeyboardNavigation) {
        return;
      }
      window.requestAnimationFrame(() => {
        const input = inputRef.current;
        const active = document.activeElement;
        if (
          !input ||
          input.disabled ||
          active === input ||
          isEditableElement(active) ||
          isInsideOverlay(active) ||
          document.querySelector('[aria-modal="true"]')
        ) {
          return;
        }
        input.focus({ preventScroll: true });
      });
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Tab") {
        isKeyboardNavigation = true;
        return;
      }
      if (event.key === "F2") {
        event.preventDefault();
        isKeyboardNavigation = false;
        focusScanInput();
      }
    };
    const handlePointerDown = () => {
      isKeyboardNavigation = false;
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keydown", handleFieldKeyDown, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointerup", restoreFocus);
    document.addEventListener("focusout", restoreFocus);
    if (autoFocus) {
      focusScanInput();
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("keydown", handleFieldKeyDown, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointerup", restoreFocus);
      document.removeEventListener("focusout", restoreFocus);
    };
  }, [autoFocus, enabled, focusReleased, focusScanInput, wedgeOptions]);

  return {
    inputRef,
    query,
    setQuery,
    clear,
    isFocused,
    focusScanInput,
    resetDuplicateGuard: () => deduperRef.current.reset(),
    inputProps: {
      value: query,
      onChange,
      onKeyDown,
      onFocus: () => setIsFocused(true),
      onBlur: () => setIsFocused(false),
      autoComplete: "off",
      spellCheck: false,
      enterKeyHint: "enter" as const,
    },
  };
};

export type InventoryBarcodeCapture = ReturnType<typeof useInventoryBarcodeCapture>;
