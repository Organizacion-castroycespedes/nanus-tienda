import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import crypto from "crypto";
import {
  assertGetAcquirerConfig,
  resolveThirdPartyLookupConfig,
} from "./third-party-lookup.config";
import { ThirdPartyLookupGetAcquirerAdapter } from "./third-party-lookup.get-acquirer-adapter";
import { ThirdPartyLookupMockAdapter } from "./third-party-lookup.mock-adapter";
import type {
  NormalizedThirdPartyLookupRequest,
  ThirdPartyLookupContext,
  ThirdPartyLookupData,
  ThirdPartyLookupField,
  ThirdPartyLookupFieldDiff,
  ThirdPartyLookupMode,
  ThirdPartyLookupPreview,
  ThirdPartyLookupProvider,
  ThirdPartyLookupRequest,
  ThirdPartyLookupResponseSummary,
  ThirdPartyLookupTargetSnapshot,
} from "./third-party-lookup.types";
import { THIRD_PARTY_LOOKUP_FIELDS } from "./third-party-lookup.types";

const FIELD_SET = new Set<string>(THIRD_PARTY_LOOKUP_FIELDS);

export const normalizeThirdPartyLookupDocument = (
  value?: string | null
): string | null => {
  const normalized = value?.trim().toUpperCase().replace(/[^0-9A-Z]/g, "") ?? "";
  return normalized.length > 0 ? normalized : null;
};

@Injectable()
export class ThirdPartyLookupService {
  constructor(
    @Inject(ThirdPartyLookupMockAdapter)
    private readonly mockAdapter: ThirdPartyLookupMockAdapter,
    @Inject(ThirdPartyLookupGetAcquirerAdapter)
    private readonly getAcquirerAdapter: ThirdPartyLookupGetAcquirerAdapter
  ) {}

  private normalizeText(value?: string | null): string | null {
    const normalized = value?.trim() ?? "";
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeRequest(
    request: ThirdPartyLookupRequest
  ): NormalizedThirdPartyLookupRequest {
    const documentTypeCode = this.normalizeText(
      request.documentTypeCode ?? request.dianIdentificationType
    )?.toUpperCase();
    const documentNumberNormalized =
      normalizeThirdPartyLookupDocument(request.documentNumber) ??
      normalizeThirdPartyLookupDocument(request.identificationNumber);

    if (!request.tenantId) {
      throw new BadRequestException("tenantId is required");
    }
    if (!documentTypeCode) {
      throw new BadRequestException("documentTypeCode is required");
    }
    if (!documentNumberNormalized) {
      throw new BadRequestException("documentNumber is required");
    }

    return {
      ...request,
      documentTypeCode,
      dianIdentificationType: documentTypeCode,
      documentNumberNormalized,
      documentNumber: documentNumberNormalized,
      identificationNumber: documentNumberNormalized,
    };
  }

  private buildRequestHash(
    input: NormalizedThirdPartyLookupRequest,
    provider: ThirdPartyLookupProvider
  ) {
    return crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          tenantId: input.tenantId,
          partyType: input.partyType,
          provider,
          documentTypeCode: input.documentTypeCode,
          documentNumberNormalized: input.documentNumberNormalized,
        })
      )
      .digest("hex");
  }

  private buildContext(
    input: NormalizedThirdPartyLookupRequest,
    mode: ThirdPartyLookupMode,
    provider: ThirdPartyLookupProvider
  ): ThirdPartyLookupContext {
    const requestHash = this.buildRequestHash(input, provider);
    return {
      lookupId: `${mode}-${requestHash.slice(0, 32)}`,
      correlationId: crypto.randomUUID(),
      provider,
      mode,
      lookupAt: new Date().toISOString(),
      requestHash,
    };
  }

  private emptySummary(): ThirdPartyLookupResponseSummary {
    return {
      fieldCount: 0,
      fields: [],
      hasLegalName: false,
      hasFiscalEmail: false,
    };
  }

  private buildDisabledPreview(
    input: NormalizedThirdPartyLookupRequest
  ): ThirdPartyLookupPreview {
    return {
      ...this.buildContext(input, "disabled", "NONE"),
      partyType: input.partyType,
      lookupStatus: "SKIPPED",
      statusCode: "DISABLED",
      message: "third party lookup is disabled",
      documentTypeCode: input.documentTypeCode,
      documentNumberNormalized: input.documentNumberNormalized,
      data: null,
      responseSummary: this.emptySummary(),
      fieldDiffs: [],
    };
  }

  lookup(request: ThirdPartyLookupRequest): ThirdPartyLookupPreview {
    const input = this.normalizeRequest(request);
    const config = resolveThirdPartyLookupConfig();
    const mode = config.mode;

    if (mode === "disabled") {
      return this.buildDisabledPreview(input);
    }

    if (mode === "mock") {
      return this.mockAdapter.lookup(
        input,
        this.buildContext(input, "mock", "MOCK_LOCAL")
      );
    }

    if (input.partyType !== "CUSTOMER") {
      return this.getAcquirerAdapter.lookup(
        input,
        this.buildContext(input, "real", "DIAN_GET_ACQUIRER")
      );
    }

    const getAcquirerConfig = assertGetAcquirerConfig(config.getAcquirer);
    return this.getAcquirerAdapter.lookup(
      input,
      this.buildContext(input, "real", "DIAN_GET_ACQUIRER"),
      { getAcquirerConfig }
    );
  }

  resolveFieldsToApply(dto: {
    fieldsToApply?: ThirdPartyLookupField[] | null;
    selectedFields?: ThirdPartyLookupField[] | null;
    applyFields?: ThirdPartyLookupField[] | null;
  }): ThirdPartyLookupField[] {
    const rawFields = dto.fieldsToApply ?? dto.selectedFields ?? dto.applyFields ?? [];

    if (!Array.isArray(rawFields)) {
      throw new BadRequestException("fieldsToApply must be an array");
    }

    const fields: ThirdPartyLookupField[] = [];
    for (const field of rawFields) {
      if (!FIELD_SET.has(field)) {
        throw new BadRequestException(`field ${field} cannot be applied`);
      }
      if (!fields.includes(field)) {
        fields.push(field);
      }
    }

    return fields;
  }

  private getTargetValue(
    target: ThirdPartyLookupTargetSnapshot,
    field: ThirdPartyLookupField
  ) {
    if (field === "documentTypeCode") {
      return target.dianIdentificationType ?? target.documentTypeCode ?? null;
    }
    if (field === "documentNumber") {
      return (
        target.identificationNumber ??
        target.documentNumberNormalized ??
        target.documentNumber ??
        null
      );
    }
    if (field === "fiscalEmail") {
      return target.fiscalEmail ?? target.invoiceEmail ?? null;
    }
    return target[field] ?? null;
  }

  private getPreviewValue(
    data: ThirdPartyLookupData,
    field: ThirdPartyLookupField
  ) {
    if (field === "documentNumber") {
      return data.documentNumberNormalized;
    }
    return data[field] ?? null;
  }

  private valuesEqual(left: unknown, right: unknown) {
    if (Array.isArray(left) || Array.isArray(right)) {
      return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
    }
    return (left ?? null) === (right ?? null);
  }

  buildFieldDiffs(
    target: ThirdPartyLookupTargetSnapshot,
    data: ThirdPartyLookupData | null,
    fieldsToApply: ThirdPartyLookupField[]
  ): ThirdPartyLookupFieldDiff[] {
    if (!data) {
      return [];
    }

    const applySet = new Set(fieldsToApply);
    return THIRD_PARTY_LOOKUP_FIELDS.map((field) => {
      const currentValue = this.getTargetValue(target, field);
      const previewValue = this.getPreviewValue(data, field);
      return {
        field,
        currentValue,
        previewValue,
        hasChange: !this.valuesEqual(currentValue, previewValue),
        willApply: applySet.has(field),
      };
    }).filter((diff) => diff.hasChange || diff.willApply);
  }

  buildSafeLookupMetadata(preview: ThirdPartyLookupPreview) {
    return {
      lookupId: preview.lookupId,
      correlationId: preview.correlationId,
      partyType: preview.partyType,
      provider: preview.provider,
      mode: preview.mode,
      lookupStatus: preview.lookupStatus,
      statusCode: preview.statusCode,
      message: preview.message,
      lookupAt: preview.lookupAt,
      requestHash: preview.requestHash,
      responseSummary: preview.responseSummary,
    };
  }

  mergeLookupMetadata(
    current: Record<string, unknown> | null | undefined,
    preview: ThirdPartyLookupPreview
  ): Record<string, unknown> {
    const base =
      current && typeof current === "object" && !Array.isArray(current)
        ? current
        : {};

    return {
      ...base,
      thirdPartyLookup: {
        lastLookup: this.buildSafeLookupMetadata(preview),
      },
    };
  }

}
