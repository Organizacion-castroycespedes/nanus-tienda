import { Injectable } from "@nestjs/common";
import type {
  NormalizedThirdPartyLookupRequest,
  ThirdPartyLookupContext,
  ThirdPartyLookupData,
  ThirdPartyLookupField,
  ThirdPartyLookupPreview,
  ThirdPartyLookupResponseSummary,
} from "./third-party-lookup.types";
import { THIRD_PARTY_LOOKUP_FIELDS } from "./third-party-lookup.types";

const getDataValue = (
  data: ThirdPartyLookupData,
  field: ThirdPartyLookupField
) => data[field];

@Injectable()
export class ThirdPartyLookupMockAdapter {
  private calculateNitVerificationDigit(documentNumber: string): string | null {
    if (!/^\d+$/.test(documentNumber)) {
      return null;
    }

    const weights = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];
    const digits = documentNumber
      .split("")
      .map((digit) => Number(digit))
      .slice(-weights.length);
    const start = weights.length - digits.length;
    const sum = digits.reduce(
      (total, digit, index) => total + digit * weights[start + index],
      0
    );
    const remainder = sum % 11;
    return String(remainder > 1 ? 11 - remainder : remainder);
  }

  private buildSummary(
    data: ThirdPartyLookupData | null
  ): ThirdPartyLookupResponseSummary {
    if (!data) {
      return {
        fieldCount: 0,
        fields: [],
        hasLegalName: false,
        hasFiscalEmail: false,
      };
    }

    const fields = THIRD_PARTY_LOOKUP_FIELDS.filter((field) => {
      const value = getDataValue(data, field);
      return Array.isArray(value) ? value.length > 0 : value !== null;
    });

    return {
      fieldCount: fields.length,
      fields,
      hasLegalName: data.legalName.length > 0,
      hasFiscalEmail: Boolean(data.fiscalEmail),
    };
  }

  lookup(
    input: NormalizedThirdPartyLookupRequest,
    context: ThirdPartyLookupContext
  ): ThirdPartyLookupPreview {
    const notFound =
      input.documentNumberNormalized.startsWith("000") ||
      input.documentNumberNormalized === "999999999";

    if (notFound) {
      return {
        ...context,
        partyType: input.partyType,
        lookupStatus: "NOT_FOUND",
        statusCode: "MOCK_NOT_FOUND",
        message: "mock fiscal lookup did not find third party",
        documentTypeCode: input.documentTypeCode,
        documentNumberNormalized: input.documentNumberNormalized,
        data: null,
        responseSummary: this.buildSummary(null),
        fieldDiffs: [],
      };
    }

    const suffix = input.documentNumberNormalized.slice(-4).padStart(4, "0");
    const isCustomer = input.partyType === "CUSTOMER";
    const label = isCustomer ? "Cliente" : "Proveedor";
    const emailPrefix = isCustomer ? "cliente" : "proveedor";
    const data: ThirdPartyLookupData = {
      name: `${label} Mock ${suffix}`,
      documentNumber: input.documentNumberNormalized,
      documentTypeCode: input.documentTypeCode,
      documentNumberNormalized: input.documentNumberNormalized,
      dianIdentificationType: input.documentTypeCode,
      identificationNumber: input.documentNumberNormalized,
      verificationDigit:
        input.documentTypeCode === "31"
          ? this.calculateNitVerificationDigit(input.documentNumberNormalized)
          : null,
      legalName: `${label} Mock SAS ${suffix}`,
      tradeName: `${label} Mock ${suffix}`,
      fiscalEmail: `${emailPrefix}-${suffix}@mock.local`,
      invoiceEmail: `${emailPrefix}-${suffix}@mock.local`,
      phone: isCustomer ? "3001234567" : "3007654321",
      address: isCustomer ? "CL 1 2 3" : "CL 4 5 6",
      countryCode: "CO",
      departmentCode: isCustomer ? "11" : "05",
      municipalityCode: isCustomer ? "11001" : "05001",
      personType: "JURIDICA",
      taxRegime: "ORDINARIO",
      taxResponsibilities: ["R-99-PN"],
    };

    return {
      ...context,
      partyType: input.partyType,
      lookupStatus: "FOUND",
      statusCode: "MOCK_FOUND",
      message: "mock fiscal lookup found third party",
      documentTypeCode: input.documentTypeCode,
      documentNumberNormalized: input.documentNumberNormalized,
      data,
      responseSummary: this.buildSummary(data),
      fieldDiffs: [],
    };
  }
}
