import { Injectable } from "@nestjs/common";
import type { FiscalProviderAdapter } from "../provider-adapter.interface";
import type {
  FiscalLookupInput,
  FiscalLookupResult,
} from "../../fiscal-lookup/fiscal-lookup.types";

@Injectable()
export class MockFiscalProviderService implements FiscalProviderAdapter {
  async lookupParty(input: FiscalLookupInput): Promise<FiscalLookupResult> {
    const label = input.partyType === "CUSTOMER" ? "Cliente" : "Proveedor";
    const emailPrefix =
      input.partyType === "CUSTOMER" ? "cliente.mock" : "proveedor.mock";

    return {
      provider: "MOCK_LOCAL",
      partyType: input.partyType,
      documentTypeCode: input.documentTypeCode,
      documentNumberNormalized: input.documentNumberNormalized,
      legalName: `${label} Mock ${input.documentNumberNormalized}`,
      fiscalEmail: `${emailPrefix}@example.com`,
      lookupStatus: "FOUND",
      message: "Mock fiscal lookup result",
    };
  }
}
