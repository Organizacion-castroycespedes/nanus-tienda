// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductBasicSection } from "./ProductBasicSection";
import { ProductOperationalSection } from "./ProductOperationalSection";
import type { ProductFormValues } from "./types";

const values: ProductFormValues = {
  name: "Producto prueba",
  sku: "SKU-1",
  standardIdentificationScheme: "",
  standardIdentificationCode: "",
  price: "100",
  priceWithTax: "100",
  priceWithoutTax: "100",
  cost: "50",
  unitId: "unit-1",
  taxId: "",
  assignedTaxes: [],
  taxProductCategoryId: "",
  alcoholDegree: "",
  netVolumeMl: "",
  daneCertifiedRetailPrice: "",
  danePriceEffectiveFrom: "",
  danePriceEffectiveTo: "",
  isActive: true,
  isInventoryable: true,
  inventoryabilityChangeReason: "",
  isPerishable: false,
  requiresLot: false,
  requiresExpiration: false,
  operationalStatus: "ACTIVE",
  rotationClass: "",
  saleType: "UNIT",
  measurementUnit: "UND",
  minStock: "",
  maxStock: "",
  categoryId: "",
  subcategoryId: "",
};

afterEach(cleanup);

const renderStructuralSections = (locked: boolean) => {
  const onChange = vi.fn();
  const basic = render(
    <ProductBasicSection
      mode={locked ? "edit" : "create"}
      values={values}
      errors={{}}
      unitOptions={[{ id: "unit-1", label: "Unidad" }]}
      catalogLoading={false}
      structuralConfigurationLocked={locked}
      onFieldChange={onChange}
      onSaleModelChange={onChange}
    />,
  );
  const [, unitControl, saleTypeControl, measurementUnitControl] =
    basic.getAllByRole("combobox");
  const basicControls = [
    unitControl,
    saleTypeControl,
    measurementUnitControl,
  ];
  basic.unmount();

  render(
    <ProductOperationalSection
      values={values}
      errors={{}}
      structuralConfigurationLocked={locked}
      onOperationalChange={onChange}
    />,
  );
  const operationalControls = [
    screen.getByRole("checkbox", { name: /Producto perecedero/ }),
    screen.getByRole("checkbox", { name: /Requiere lote/ }),
    screen.getByRole("checkbox", { name: /Requiere vencimiento/ }),
  ];

  return [...basicControls, ...operationalControls];
};

describe("product structural configuration controls", () => {
  it("keeps all structural controls enabled during creation", () => {
    const controls = renderStructuralSections(false);

    for (const control of controls) {
      expect((control as HTMLInputElement | HTMLSelectElement).disabled).toBe(
        false,
      );
    }
  });

  it("locks all structural controls after the first save", () => {
    const controls = renderStructuralSections(true);

    for (const control of controls) {
      expect((control as HTMLInputElement | HTMLSelectElement).disabled).toBe(
        true,
      );
    }
    expect(
      screen.getByText(/no pueden cambiarse despues del primer guardado/i),
    ).toBeTruthy();
  });
});
