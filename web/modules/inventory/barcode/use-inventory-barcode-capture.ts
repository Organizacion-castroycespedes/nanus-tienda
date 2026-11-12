import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
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
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointerup", restoreFocus);
    document.addEventListener("focusout", restoreFocus);
    if (autoFocus) {
      focusScanInput();
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointerup", restoreFocus);
      document.removeEventListener("focusout", restoreFocus);
    };
  }, [autoFocus, enabled, focusReleased, focusScanInput]);

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
