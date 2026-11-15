// @vitest-environment jsdom

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductResponse } from "../../../domains/products/dtos";
import { ProductForm } from "./ProductForm";

const testState = vi.hoisted(() => ({ role: "ADMIN" }));
const mocks = vi.hoisted(() => ({
  createProduct: vi.fn(),
  deleteProductImage: vi.fn(),
  getFiscalPreview: vi.fn(),
  getProduct: vi.fn(),
  updateProduct: vi.fn(),
  uploadProductImage: vi.fn(),
  getTaxes: vi.fn(),
  getTaxCatalogs: vi.fn(),
  getUnits: vi.fn(),
  listProductCategories: vi.fn(),
  listProductSubcategoriesByCategory: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ tenant: "premium-brands" }),
}));

vi.mock("../../../store/hooks", () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      auth: {
        role: testState.role,
        user: { role: testState.role },
      },
    }),
}));

vi.mock("../services/product.service", () => ({
  createProduct: mocks.createProduct,
  deleteProductImage: mocks.deleteProductImage,
  getFiscalPreview: mocks.getFiscalPreview,
  getProduct: mocks.getProduct,
  updateProduct: mocks.updateProduct,
  uploadProductImage: mocks.uploadProductImage,
}));

vi.mock("../services/tax.service", () => ({
  getTaxes: mocks.getTaxes,
  getTaxCatalogs: mocks.getTaxCatalogs,
}));

vi.mock("../services/unit.service", () => ({
  getUnits: mocks.getUnits,
}));

vi.mock("../services/product-classification.service", () => ({
  listProductCategories: mocks.listProductCategories,
  listProductSubcategoriesByCategory:
    mocks.listProductSubcategoriesByCategory,
}));

const existingProduct: ProductResponse = {
  id: "product-1",
  tenantId: "tenant-premium-brands",
  unitId: "unit-1",
  taxId: "vat-19",
  taxes: [
    {
      id: "assignment-vat",
      taxId: "vat-19",
      calculationOrder: 100,
      isActive: true,
      isIncluded: true,
      calculationMethodCode: "PERCENTAGE",
      taxTypeCode: "VAT",
    },
    {
      id: "assignment-adv",
      taxId: "adv",
      calculationOrder: 200,
      isActive: true,
      isIncluded: true,
      calculationMethodCode: "FIXED_AMOUNT",
      taxTypeCode: "AD_VALOREM",
    },
  ],
  taxProfile: {
    taxProductCategoryId: "category-liquor",
    taxProductCategoryCode: "LIQUOR",
    isAlcoholicBeverage: true,
    alcoholDegree: 40,
    netVolumeMl: 1000,
    daneCertifiedRetailPrice: 229238,
    danePriceEffectiveFrom: "2026-01-01",
    danePriceEffectiveTo: "2026-12-31",
  },
  name: "Whisky prueba",
  description: null,
  sku: "WHISKY-1",
  standardIdentification: { scheme: "999", code: "WHISKY-1" },
  price: 229238,
  cost: 150000,
  priceWithTax: 229238,
  priceWithoutTax: 145455.71,
  isActive: true,
  isInventoryable: true,
  isPerishable: false,
  requiresLot: false,
  requiresExpiration: false,
  requiresSerial: false,
  operationalStatus: "ACTIVE",
  rotationClass: null,
  saleType: "UNIT",
  measurementUnit: "UND",
  minStock: null,
  maxStock: null,
  categoryId: null,
  subcategoryId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const renderForm = (mode: "create" | "edit" = "create") =>
  render(
    <ProductForm
      mode={mode}
      product={mode === "edit" ? existingProduct : null}
      onCancel={vi.fn()}
      onSuccess={vi.fn()}
    />,
  );

const waitForCatalogs = async () => {
  await waitFor(() => {
    expect(screen.getByRole("option", { name: "Unidad (UND)" })).toBeTruthy();
  });
};

const fillRequiredCreateFields = async () => {
  await waitForCatalogs();
  fireEvent.change(screen.getByLabelText(/Nombre/), {
    target: { value: "Producto fiscal" },
  });
  fireEvent.change(screen.getByPlaceholderText("Ej: ARR-001"), {
    target: { value: "FISCAL-1" },
  });
  fireEvent.change(screen.getByLabelText(/Codigo estandar DIAN/), {
    target: { value: "FISCAL-1" },
  });
  fireEvent.change(screen.getByLabelText(/Precio de venta/), {
    target: { value: "11900" },
  });
  fireEvent.change(screen.getByLabelText(/^Costo/), {
    target: { value: "8000" },
  });
  fireEvent.change(screen.getByDisplayValue("Selecciona una unidad"), {
    target: { value: "unit-1" },
  });
};

const openFiscalAccordion = () => {
  fireEvent.click(screen.getByRole("button", { name: /avanzada/i }));
};

const addTax = (taxId: string) => {
  fireEvent.click(screen.getByRole("button", { name: "Agregar impuesto" }));
  fireEvent.change(screen.getByLabelText("Aplicacion #1"), {
    target: { value: taxId },
  });
};

beforeEach(() => {
  testState.role = "ADMIN";
  mocks.getUnits.mockResolvedValue([
    {
      id: "unit-1",
      tenantId: "tenant-premium-brands",
      name: "Unidad",
      abbreviation: "UND",
      isActive: true,
    },
  ]);
  mocks.getTaxes.mockResolvedValue([
    {
      id: "vat-19",
      tenantId: "tenant-premium-brands",
      name: "IVA 19%",
      rate: 0.19,
      isIncluded: true,
      isActive: true,
      calculationMethodCode: "PERCENTAGE",
      taxTypeCode: "VAT",
    },
    {
      id: "adv",
      tenantId: "tenant-premium-brands",
      name: "ADV",
      rate: 0.25,
      isIncluded: true,
      isActive: true,
      calculationMethodCode: "FIXED_AMOUNT",
      taxTypeCode: "AD_VALOREM",
    },
  ]);
  mocks.getTaxCatalogs.mockResolvedValue({
    types: [],
    calculationMethods: [],
    baseTypes: [],
    productCategories: [
      {
        id: "category-general",
        code: "GENERAL",
        name: "General",
        isActive: true,
        isAlcoholicBeverage: false,
      },
      {
        id: "category-liquor",
        code: "LIQUOR",
        name: "Licores",
        isActive: true,
        isAlcoholicBeverage: true,
      },
    ],
  });
  mocks.listProductCategories.mockResolvedValue([]);
  mocks.listProductSubcategoriesByCategory.mockResolvedValue([]);
  mocks.getProduct.mockResolvedValue(existingProduct);
  mocks.getFiscalPreview.mockResolvedValue({
    lineSubtotal: 10000,
    lineTaxTotal: 1900,
    lineTotal: 11900,
    taxes: [],
  });
  mocks.createProduct.mockResolvedValue(existingProduct);
  mocks.updateProduct.mockResolvedValue(existingProduct);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProductForm fiscal advanced authorization", () => {
  it.each(["ADMIN", "SUPER_USER", "SUPER_ADMIN"])(
    "renders fiscal advanced controls for authorized %s",
    async (role: string) => {
      testState.role = role;
      renderForm();
      await waitForCatalogs();

      expect(
        screen.getByRole("button", { name: /avanzada/i }),
      ).toBeTruthy();
    },
  );

  it("does not render fiscal advanced controls for USER", async () => {
    testState.role = "USER";
    renderForm();
    await waitForCatalogs();

    expect(screen.queryByRole("button", { name: /avanzada/i })).toBeNull();
  });

  it("creates an ADMIN product with taxes, category, DANE price and validity", async () => {
    renderForm();
    await fillRequiredCreateFields();
    openFiscalAccordion();

    fireEvent.change(screen.getByLabelText("Categoria fiscal"), {
      target: { value: "category-general" },
    });
    fireEvent.change(screen.getByLabelText("Precio DANE certificado"), {
      target: { value: "11900" },
    });
    fireEvent.change(screen.getByLabelText("DANE vigente desde"), {
      target: { value: "2026-01-01" },
    });
    fireEvent.change(screen.getByLabelText("DANE vigente hasta"), {
      target: { value: "2026-12-31" },
    });
    addTax("vat-19");

    fireEvent.click(screen.getByRole("button", { name: "Guardar producto" }));

    await waitFor(() => expect(mocks.createProduct).toHaveBeenCalledTimes(1));
    expect(mocks.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        taxId: "vat-19",
        taxes: [
          {
            taxId: "vat-19",
            calculationOrder: 100,
            isIncluded: true,
          },
        ],
        taxProfile: {
          taxProductCategoryId: "category-general",
          alcoholDegree: null,
          netVolumeMl: null,
          daneCertifiedRetailPrice: 11900,
          danePriceEffectiveFrom: "2026-01-01",
          danePriceEffectiveTo: "2026-12-31",
        },
      }),
    );
  });

  it("applies ADV validation for ADMIN before creating", async () => {
    renderForm();
    await fillRequiredCreateFields();
    openFiscalAccordion();

    fireEvent.change(screen.getByLabelText("Categoria fiscal"), {
      target: { value: "category-liquor" },
    });
    addTax("adv");
    fireEvent.change(screen.getByLabelText(/volumen neto/i), {
      target: { value: "750" },
    });
    fireEvent.change(screen.getByLabelText(/Grado de alcohol/i), {
      target: { value: "35" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Guardar producto" }));

    expect(
      await screen.findByText("El precio DANE es requerido cuando hay ADV."),
    ).toBeTruthy();
    expect(mocks.createProduct).not.toHaveBeenCalled();
  });

  it("preserves existing assignments and fiscal profile during ADMIN edit", async () => {
    renderForm("edit");
    await waitForCatalogs();
    await waitFor(() => expect(mocks.getProduct).toHaveBeenCalledWith("product-1"));
    openFiscalAccordion();

    const orderInputs = screen.getAllByLabelText("Orden");
    fireEvent.change(orderInputs[0], { target: { value: "50" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Actualizar producto" }),
    );

    await waitFor(() => expect(mocks.updateProduct).toHaveBeenCalledTimes(1));
    expect(mocks.updateProduct).toHaveBeenCalledWith(
      "product-1",
      expect.objectContaining({
        taxId: "vat-19",
        taxes: [
          {
            taxId: "vat-19",
            calculationOrder: 50,
            isIncluded: true,
          },
          {
            taxId: "adv",
            calculationOrder: 200,
            isIncluded: true,
          },
        ],
        taxProfile: {
          taxProductCategoryId: "category-liquor",
          alcoholDegree: 40,
          netVolumeMl: 1000,
          daneCertifiedRetailPrice: 229238,
          danePriceEffectiveFrom: "2026-01-01",
          danePriceEffectiveTo: "2026-12-31",
        },
      }),
    );
  });
});
