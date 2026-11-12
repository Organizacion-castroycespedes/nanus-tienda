import React from "react";
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
