import { XMLParser, XMLValidator } from "fast-xml-parser";
import {
  THIRD_PARTY_LOOKUP_FIELDS,
  type ThirdPartyLookupData,
  type ThirdPartyLookupField,
  type ThirdPartyLookupResponseSummary,
  type ThirdPartyLookupStatus,
} from "./third-party-lookup.types";

export type GetAcquirerResponseIdentity = {
  identificationType: string;
  identificationNumber: string;
};

export type GetAcquirerSanitizedSummary = {
  dianStatusCode: string | null;
  dianStatusMessage: string | null;
  fieldCount: number;
  fields: ThirdPartyLookupField[];
  hasFiscalEmail: boolean;
  hasGetAcquirerResult: boolean;
  hasLegalName: boolean;
  hasSoapFault: boolean;
};

export type ParsedGetAcquirerResponse = {
  data: ThirdPartyLookupData | null;
  dianStatusCode?: string;
  dianStatusMessage?: string;
  lookupStatus: ThirdPartyLookupStatus;
  message: string;
  responseSummary: ThirdPartyLookupResponseSummary;
  sanitizedSummary: GetAcquirerSanitizedSummary;
  statusCode: string;
};

type UnknownRecord = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  parseAttributeValue: false,
  parseTagValue: false,
  removeNSPrefix: true,
  trimValues: true,
});

const XML_TEXT_NODE = "#text";
const XML_ATTRIBUTE_PREFIX = "@_";

const EMPTY_RESPONSE_SUMMARY: ThirdPartyLookupResponseSummary = {
  fieldCount: 0,
  fields: [],
  hasLegalName: false,
  hasFiscalEmail: false,
};

const buildSanitizedSummary = (
  overrides: Partial<GetAcquirerSanitizedSummary> = {}
): GetAcquirerSanitizedSummary => ({
  dianStatusCode: null,
  dianStatusMessage: null,
  fieldCount: 0,
  fields: [],
  hasFiscalEmail: false,
  hasGetAcquirerResult: false,
  hasLegalName: false,
  hasSoapFault: false,
  ...overrides,
});

const asRecord = (value: unknown): UnknownRecord | null => {
  if (Array.isArray(value)) {
    return asRecord(value[0]);
  }
  return value && typeof value === "object" ? (value as UnknownRecord) : null;
};

const asText = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "object") {
    const textValue = asRecord(value)?.[XML_TEXT_NODE];
    return textValue === value ? null : asText(textValue);
  }
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
};

const readText = (record: UnknownRecord | null, keys: string[]) => {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = asText(record[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const readNestedText = (
  record: UnknownRecord | null,
  path: string[]
): string | null => {
  let current: unknown = record;
  for (const key of path) {
    current = asRecord(current)?.[key];
  }
  return asText(current);
};

const readNestedAttribute = (
  record: UnknownRecord | null,
  path: string[],
  attributeName: string
): string | null => {
  let current: unknown = record;
  for (const key of path) {
    current = asRecord(current)?.[key];
  }
  return asText(asRecord(current)?.[`${XML_ATTRIBUTE_PREFIX}${attributeName}`]);
};

const findRecordByKey = (
  value: unknown,
  key: string
): UnknownRecord | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const direct = asRecord(record[key]);
  if (direct) {
    return direct;
  }

  for (const child of Object.values(record)) {
    const found = findRecordByKey(child, key);
    if (found) {
      return found;
    }
  }

  return null;
};

const isNotFound = (
  dianStatusCode: string | null,
  dianStatusMessage: string | null
) => {
  const text = `${dianStatusCode ?? ""} ${dianStatusMessage ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return (
    text.includes("not_found") ||
    text.includes("not found") ||
    text.includes("notfound") ||
    text.includes("no encontrado") ||
    text.includes("no existe") ||
    text.includes("sin resultado")
  );
};

const buildResponseSummary = (
  fields: ThirdPartyLookupField[],
  hasLegalName: boolean,
  hasFiscalEmail: boolean
): ThirdPartyLookupResponseSummary => ({
  fieldCount: fields.length,
  fields,
  hasLegalName,
  hasFiscalEmail,
});

const addField = (
  fields: ThirdPartyLookupField[],
  field: ThirdPartyLookupField,
  value: unknown
) => {
  if (asText(value) && THIRD_PARTY_LOOKUP_FIELDS.includes(field)) {
    fields.push(field);
  }
};

const parseSoapFault = (
  fault: UnknownRecord
): ParsedGetAcquirerResponse => {
  const dianStatusCode =
    readNestedText(fault, ["Code", "Value"]) ??
    readText(fault, ["faultcode", "Code", "StatusCode"]) ??
    "SOAP_FAULT";
  const dianStatusMessage =
    readNestedText(fault, ["Reason", "Text"]) ??
    readText(fault, ["faultstring", "Reason", "Message"]) ??
    null;

  return {
    data: null,
    dianStatusCode,
    dianStatusMessage: dianStatusMessage ?? undefined,
    lookupStatus: "ERROR",
    message: "DIAN GetAcquirer SOAP fault received",
    responseSummary: EMPTY_RESPONSE_SUMMARY,
    sanitizedSummary: buildSanitizedSummary({
      dianStatusCode,
      dianStatusMessage,
      hasSoapFault: true,
    }),
    statusCode: "SOAP_FAULT",
  };
};

export const parseGetAcquirerResponse = (
  responseXml: string,
  identity: GetAcquirerResponseIdentity
): ParsedGetAcquirerResponse => {
  const validation = XMLValidator.validate(responseXml);
  if (validation !== true) {
    return {
      data: null,
      lookupStatus: "ERROR",
      message: "DIAN GetAcquirer response XML is invalid",
      responseSummary: EMPTY_RESPONSE_SUMMARY,
      sanitizedSummary: buildSanitizedSummary(),
      statusCode: "XML_PARSE_ERROR",
    };
  }

  const parsed = parser.parse(responseXml);
  const fault = findRecordByKey(parsed, "Fault");
  if (fault) {
    return parseSoapFault(fault);
  }

  const result = findRecordByKey(parsed, "GetAcquirerResult");
  if (!result) {
    return {
      data: null,
      lookupStatus: "ERROR",
      message: "DIAN GetAcquirer response did not include a recognized result",
      responseSummary: EMPTY_RESPONSE_SUMMARY,
      sanitizedSummary: buildSanitizedSummary(),
      statusCode: "DIAN_RESPONSE_UNSUPPORTED",
    };
  }

  const dianStatusCode = readText(result, [
    "StatusCode",
    "ResponseCode",
    "Code",
    "Status",
  ]);
  const dianStatusMessage = readText(result, [
    "StatusMessage",
    "StatusDescription",
    "Message",
    "Description",
  ]);

  if (isNotFound(dianStatusCode, dianStatusMessage)) {
    return {
      data: null,
      dianStatusCode: dianStatusCode ?? undefined,
      dianStatusMessage: dianStatusMessage ?? undefined,
      lookupStatus: "NOT_FOUND",
      message: "DIAN GetAcquirer did not find the acquirer",
      responseSummary: EMPTY_RESPONSE_SUMMARY,
      sanitizedSummary: buildSanitizedSummary({
        dianStatusCode,
        dianStatusMessage,
        hasGetAcquirerResult: true,
      }),
      statusCode: dianStatusCode ?? "DIAN_NOT_FOUND",
    };
  }

  const accountingCustomerParty = findRecordByKey(
    result,
    "AccountingCustomerParty"
  );
  const taxRepresentativeParty = findRecordByKey(
    result,
    "TaxRepresentativeParty"
  );
  const documentTypeCode =
    readText(result, ["IdentificationType", "DocumentTypeCode"]) ??
    readNestedAttribute(
      accountingCustomerParty,
      ["PartyIdentification", "ID"],
      "schemeName"
    ) ??
    readNestedAttribute(
      accountingCustomerParty,
      ["Party", "PartyIdentification", "ID"],
      "schemeName"
    ) ??
    identity.identificationType;
  const documentNumberNormalized =
    readText(result, ["IdentificationNumber", "DocumentNumber"]) ??
    readNestedText(taxRepresentativeParty, ["PartyIdentification", "ID"]) ??
    readNestedText(taxRepresentativeParty, ["Party", "PartyIdentification", "ID"]) ??
    readNestedText(accountingCustomerParty, ["PartyIdentification", "ID"]) ??
    readNestedText(accountingCustomerParty, ["Party", "PartyIdentification", "ID"]) ??
    identity.identificationNumber;
  const legalName = readText(result, [
    "LegalName",
    "RegistrationName",
    "BusinessName",
    "RazonSocial",
    "Name",
  ]) ??
    readNestedText(accountingCustomerParty, ["Contact", "Name"]) ??
    readNestedText(accountingCustomerParty, ["Party", "Contact", "Name"]) ??
    readNestedText(accountingCustomerParty, [
      "Party",
      "PartyLegalEntity",
      "RegistrationName",
    ]) ??
    readNestedText(accountingCustomerParty, ["Party", "PartyName", "Name"]);
  const tradeName = readText(result, ["TradeName", "CommercialName"]);
  const fiscalEmail = readText(result, [
    "FiscalEmail",
    "ElectronicMail",
    "Email",
    "CorreoElectronico",
  ]) ??
    readNestedText(accountingCustomerParty, ["Contact", "ElectronicMail"]) ??
    readNestedText(accountingCustomerParty, [
      "Party",
      "Contact",
      "ElectronicMail",
    ]);
  const phone =
    readText(result, ["Phone", "Telephone", "Telefono"]) ??
    readNestedText(accountingCustomerParty, ["Contact", "Telephone"]) ??
    readNestedText(accountingCustomerParty, ["Party", "Contact", "Telephone"]);
  const address = readText(result, ["Address", "Line", "Direccion"]);
  const name = legalName ?? tradeName ?? `DIAN GetAcquirer ${documentNumberNormalized}`;

  const fields: ThirdPartyLookupField[] = [];
  addField(fields, "documentTypeCode", documentTypeCode);
  addField(fields, "documentNumber", documentNumberNormalized);
  addField(fields, "legalName", legalName);
  addField(fields, "tradeName", tradeName);
  addField(fields, "fiscalEmail", fiscalEmail);
  addField(fields, "phone", phone);
  addField(fields, "address", address);

  const responseSummary = buildResponseSummary(
    Array.from(new Set(fields)),
    Boolean(legalName),
    Boolean(fiscalEmail)
  );

  const data: ThirdPartyLookupData = {
    name,
    documentNumber: documentNumberNormalized,
    documentTypeCode,
    documentNumberNormalized,
    dianIdentificationType: documentTypeCode,
    identificationNumber: documentNumberNormalized,
    verificationDigit: readText(result, ["VerificationDigit", "DV"]),
    legalName: legalName ?? name,
    tradeName: tradeName ?? legalName ?? name,
    fiscalEmail,
    invoiceEmail: fiscalEmail,
    phone,
    address,
    countryCode: readText(result, ["CountryCode"]),
    departmentCode: readText(result, ["DepartmentCode"]),
    municipalityCode: readText(result, ["MunicipalityCode"]),
    personType: "UNKNOWN",
    taxRegime: readText(result, ["TaxRegime"]),
    taxResponsibilities: [],
  };

  return {
    data,
    dianStatusCode: dianStatusCode ?? undefined,
    dianStatusMessage: dianStatusMessage ?? undefined,
    lookupStatus: "FOUND",
    message: "DIAN GetAcquirer response parsed safely",
    responseSummary,
    sanitizedSummary: buildSanitizedSummary({
      dianStatusCode,
      dianStatusMessage,
      fieldCount: responseSummary.fieldCount,
      fields: responseSummary.fields,
      hasFiscalEmail: responseSummary.hasFiscalEmail,
      hasGetAcquirerResult: true,
      hasLegalName: responseSummary.hasLegalName,
    }),
    statusCode: dianStatusCode ?? "DIAN_RESPONSE_RECEIVED",
  };
};
