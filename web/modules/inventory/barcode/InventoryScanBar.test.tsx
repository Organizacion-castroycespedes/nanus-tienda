import React, { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { InventoryScanBar } from "./InventoryScanBar";
import { createInventoryScanFeedback, type InventoryScanFeedback } from "./inventory-scan-feedback";
import {
  useInventoryBarcodeCapture,
  type UseInventoryBarcodeCaptureOptions,
} from "./use-inventory-barcode-capture";

type HarnessProps = Partial<UseInventoryBarcodeCaptureOptions> & {
  feedback?: InventoryScanFeedback | null;
  onSubmitForm?: () => void;
};

const Harness = ({ feedback = null, onSubmitForm, ...options }: HarnessProps) => {
  const capture = useInventoryBarcodeCapture({
    enabled: true,
    autoFocus: false,
    onScan: options.onScan ?? (() => undefined),
    onManualSubmit: options.onManualSubmit,
    onDuplicateIgnored: options.onDuplicateIgnored,
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmitForm?.();
      }}
    >
      <InventoryScanBar id="scan" capture={capture} feedback={feedback} />
    </form>
  );
};

const scan = (input: HTMLElement, code: string) => {
  for (const key of code.split("")) {
    fireEvent.keyDown(input, { key });
  }
  fireEvent.keyDown(input, { key: "Enter" });
};

type FieldHarnessProps = {
  onFieldScan: (code: string) => boolean;
  onSubmitForm: () => void;
};

const FieldHarness = ({ onFieldScan, onSubmitForm }: FieldHarnessProps) => {
  const formRef = useRef<HTMLFormElement>(null);
  const [lot, setLot] = useState("L1");
  const capture = useInventoryBarcodeCapture({
    enabled: true,
    autoFocus: false,
    onScan: () => undefined,
    fieldScanScope: formRef,
    onFieldScan,
  });
  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmitForm();
      }}
    >
      <InventoryScanBar id="scan" capture={capture} />
      <input aria-label="Lote" value={lot} onChange={(event) => setLot(event.target.value)} />
    </form>
  );
};

const scanIntoField = (field: HTMLInputElement, code: string) => {
  for (const key of code.split("")) {
    fireEvent.keyDown(field, { key });
  }
  // El navegador escribe los caracteres en el campo antes del Enter.
  fireEvent.change(field, { target: { value: `${field.value}${code}` } });
  fireEvent.keyDown(field, { key: "Enter" });
};

afterEach(() => cleanup());

describe("InventoryScanBar + useInventoryBarcodeCapture", () => {
  it("reports a fast scanner read once and clears the bar", () => {
    const onScan = vi.fn();
    render(<Harness onScan={onScan} />);
    const input = screen.getByLabelText("Escanear o buscar producto") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "7701234567890" } });
    scan(input, "7701234567890");
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith("7701234567890");
    expect(input.value).toBe("");
  });

  it("ignores an immediate duplicate read", () => {
    const onScan = vi.fn();
    const onDuplicateIgnored = vi.fn();
    render(<Harness onScan={onScan} onDuplicateIgnored={onDuplicateIgnored} />);
    const input = screen.getByLabelText("Escanear o buscar producto");
    scan(input, "7701234567890");
    scan(input, "7701234567890");
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onDuplicateIgnored).toHaveBeenCalledWith("7701234567890");
  });

  it("sends Enter on typed text to manual search without submitting the form", () => {
    const onManualSubmit = vi.fn();
    const onSubmitForm = vi.fn();
    render(<Harness onManualSubmit={onManualSubmit} onSubmitForm={onSubmitForm} />);
    const input = screen.getByLabelText("Escanear o buscar producto");
    fireEvent.change(input, { target: { value: "leche" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onManualSubmit).toHaveBeenCalledWith("leche");
    expect(onSubmitForm).not.toHaveBeenCalled();
  });

  it("clears the bar with Escape", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Escanear o buscar producto") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "arroz" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("");
  });

  it("routes a scanner read typed into another field and restores that field", () => {
    const onFieldScan = vi.fn(() => true);
    const onSubmitForm = vi.fn();
    render(<FieldHarness onFieldScan={onFieldScan} onSubmitForm={onSubmitForm} />);
    const lot = screen.getByLabelText("Lote") as HTMLInputElement;
    scanIntoField(lot, "353962561087655");
    expect(onFieldScan).toHaveBeenCalledWith("353962561087655", lot);
    expect(lot.value).toBe("L1");
    expect(onSubmitForm).not.toHaveBeenCalled();
  });

  it("keeps an intentional lot scan without submitting the form", () => {
    const onFieldScan = vi.fn(() => false);
    const onSubmitForm = vi.fn();
    render(<FieldHarness onFieldScan={onFieldScan} onSubmitForm={onSubmitForm} />);
    const lot = screen.getByLabelText("Lote") as HTMLInputElement;
    scanIntoField(lot, "LOTE20261130");
    expect(onFieldScan).toHaveBeenCalledWith("LOTE20261130", lot);
    expect(lot.value).toBe("L1LOTE20261130");
    expect(onSubmitForm).not.toHaveBeenCalled();
  });

  it("does not intercept human typing in other fields", () => {
    const onFieldScan = vi.fn(() => true);
    render(<FieldHarness onFieldScan={onFieldScan} onSubmitForm={() => undefined} />);
    const lot = screen.getByLabelText("Lote") as HTMLInputElement;
    fireEvent.keyDown(lot, { key: "A" });
    fireEvent.keyDown(lot, { key: "Enter" });
    expect(onFieldScan).not.toHaveBeenCalled();
  });

  it("shows the reader status and announces errors assertively", () => {
    render(<Harness feedback={createInventoryScanFeedback("error", "Código no encontrado: 123")} />);
    const input = screen.getByLabelText("Escanear o buscar producto");
    expect(screen.getByText("F2 para escanear")).toBeTruthy();
    fireEvent.focus(input);
    expect(screen.getByText("Lector listo")).toBeTruthy();
    const assertive = document.querySelector('[aria-live="assertive"]');
    expect(assertive?.textContent).toBe("Código no encontrado: 123");
  });
});
