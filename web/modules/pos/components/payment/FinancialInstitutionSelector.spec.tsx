// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FinancialInstitution } from "../../../finance/types";
import { FinancialInstitutionSelector } from "./FinancialInstitutionSelector";

const institution = (
  id: string,
  nombre: string,
  tipo: FinancialInstitution["tipo"] = "BANK",
  active = true
): FinancialInstitution => ({
  id,
  tenantId: null,
  codigo: id.toUpperCase(),
  nombre,
  nombreCorto: nombre,
  tipo,
  logoUrl: null,
  active,
  sortOrder: 0,
  createdAt: "2026-11-06T00:00:00.000Z",
  updatedAt: "2026-11-06T00:00:00.000Z",
});

afterEach(cleanup);

describe("FinancialInstitutionSelector", () => {
  it("renders all 12 active POS catalog institutions after expanding", () => {
    const institutions = Array.from({ length: 12 }, (_, index) =>
      institution(`bank-${index + 1}`, `Banco ${index + 1}`)
    );
    render(
      <FinancialInstitutionSelector
        institutions={[
          ...institutions,
          institution("inactive", "Banco inactivo", "BANK", false),
        ]}
        selectedInstitutionId={null}
        onSelectInstitution={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver todos los bancos (12)" }));
    expect(
      screen
        .getAllByRole("button")
        .filter((button) => button.getAttribute("title")?.startsWith("Banco "))
    ).toHaveLength(12);
    expect(screen.queryByRole("button", { name: /Banco inactivo/ })).toBeNull();
  });

  it("shows the original empty-catalog message", () => {
    render(
      <FinancialInstitutionSelector
        institutions={[]}
        selectedInstitutionId={null}
        onSelectInstitution={vi.fn()}
      />
    );

    expect(screen.getByText("No hay resultados.")).toBeTruthy();
  });

  it("searches active institutions and selects one independently", () => {
    const onSelect = vi.fn();
    render(
      <FinancialInstitutionSelector
        institutions={[
          institution("bancolombia", "Bancolombia"),
          institution("nequi", "Nequi", "WALLET"),
          institution("inactive", "Banco inactivo", "BANK", false),
        ]}
        selectedInstitutionId={null}
        onSelectInstitution={onSelect}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Buscar banco o billetera..."), {
      target: { value: "nequi" },
    });

    expect(screen.queryByRole("button", { name: "Bancolombia" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Banco inactivo" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Nequi/ }));
    expect(onSelect).toHaveBeenCalledWith("nequi");
  });

  it("reports search misses without calling them a configuration error", () => {
    render(
      <FinancialInstitutionSelector
        institutions={[institution("bank", "Banco permitido")]}
        selectedInstitutionId={null}
        onSelectInstitution={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Buscar banco o billetera..."), {
      target: { value: "no-existe" },
    });

    expect(screen.getByText("No hay resultados.")).toBeTruthy();
  });
});
