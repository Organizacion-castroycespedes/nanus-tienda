import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  FISCAL_PROVIDER_ADAPTER,
  type FiscalProviderAdapter,
} from "../providers/provider-adapter.interface";
import type {
  FiscalLookupInput,
  FiscalLookupPreviewRequest,
  FiscalLookupResult,
  PartyType,
} from "./fiscal-lookup.types";

@Injectable()
export class FiscalLookupService {
  constructor(
    @Inject(FISCAL_PROVIDER_ADAPTER)
    private readonly fiscalProvider: FiscalProviderAdapter
  ) {}

  async preview(
    request: FiscalLookupPreviewRequest
  ): Promise<FiscalLookupResult> {
    const input = this.buildInput(request);
    return this.fiscalProvider.lookupParty(input);
  }

  normalizeDocumentNumber(documentNumber: string): string {
    return documentNumber.replace(/[\s.\-]/g, "").trim();
  }

  private buildInput(request: FiscalLookupPreviewRequest): FiscalLookupInput {
    const partyType = this.normalizePartyType(request.partyType);
    const documentTypeCode = request.documentTypeCode?.trim();
    const documentNumber = request.documentNumber?.trim();

    if (!documentTypeCode) {
      throw new BadRequestException("documentTypeCode is required");
    }
    if (!documentNumber) {
      throw new BadRequestException("documentNumber is required");
    }

    const documentNumberNormalized =
      this.normalizeDocumentNumber(documentNumber);
    if (!documentNumberNormalized) {
      throw new BadRequestException("documentNumber is required");
    }

    return {
      partyType,
      documentTypeCode,
      documentNumber,
      documentNumberNormalized,
    };
  }

  private normalizePartyType(partyType: string | undefined): PartyType {
    if (partyType === "CUSTOMER" || partyType === "SUPPLIER") {
      return partyType;
    }
    throw new BadRequestException("partyType must be CUSTOMER or SUPPLIER");
  }
}
