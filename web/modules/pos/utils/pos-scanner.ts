import type { ProductResponse } from "../../../domains/products/dtos";

type PosScannerProductBarcodeCandidate =
  | string
  | {
      barcode?: string | null;
      codigo?: string | null;
      codigoBarras?: string | null;
      codigo_barras?: string | null;
      code?: string | null;
      value?: string | null;
      isActive?: boolean;
      active?: boolean;
    };

export type PosScannerProductCandidate = Omit<ProductResponse, "barcodes"> & {
  primaryBarcode?: string | null;
  barcodeCodes?: string[];
  barcode?: string | null;
  codigoBarras?: string | null;
  codigo_barras?: string | null;
  reference?: string | null;
  referencia?: string | null;
  code?: string | null;
  codigo?: string | null;
  barcodes?: PosScannerProductBarcodeCandidate[];
};

export const normalizePosScannerCode = (value?: string | null) =>
  typeof value === "string"
    ? value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
    : "";

export const collectPosScannerProductCodes = (product: ProductResponse) => {
  const candidate = product as unknown as PosScannerProductCandidate;
  const directCodes = [
    candidate.primaryBarcode,
    candidate.barcode,
    candidate.codigoBarras,
    candidate.codigo_barras,
    candidate.sku,
    candidate.reference,
    candidate.referencia,
    candidate.code,
    candidate.codigo,
    candidate.id,
  ];
  const barcodeCodes = (candidate.barcodes ?? [])
    .filter((barcode) =>
      typeof barcode === "string"
        ? true
        : barcode.isActive !== false && barcode.active !== false
    )
    .flatMap((barcode) => {
      if (typeof barcode === "string") {
        return [barcode];
      }

      return [
        barcode.barcode,
        barcode.codigoBarras,
        barcode.codigo_barras,
        barcode.code,
        barcode.codigo,
        barcode.value,
      ];
    });

  return [...directCodes, ...(candidate.barcodeCodes ?? []), ...barcodeCodes]
    .map(normalizePosScannerCode)
    .filter(Boolean);
};

export const findUniquePosScannerProduct = (
  code: string,
  products: ProductResponse[]
) => {
  const normalizedCode = normalizePosScannerCode(code);
  if (!normalizedCode) {
    return null;
  }

  const matches = products.filter((product) =>
    collectPosScannerProductCodes(product).some(
      (candidateCode) => candidateCode === normalizedCode
    )
  );

  return matches.length === 1 ? matches[0] : null;
};
