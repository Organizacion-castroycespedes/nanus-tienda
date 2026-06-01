import type {
  FiscalLookupInput,
  FiscalLookupResult,
} from "../../fiscal-lookup/fiscal-lookup.types";

type ResponseSummary = {
  hasLegalName: boolean;
  hasFiscalEmail: boolean;
  documentTypeCode: string;
  documentNumberMasked: string;
};

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const stripTags = (value: string): string =>
  normalizeWhitespace(value.replace(/<[^>]+>/g, ""));

const unescapeXml = (value: string): string =>
  value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");

const findElementText = (xml: string, localName: string): string | null => {
  const pattern = new RegExp(
    `<(?:[\\w.-]+:)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${localName}>`,
    "i"
  );
  const match = xml.match(pattern);
  return match ? unescapeXml(stripTags(match[1])) : null;
};

const findBlock = (xml: string, localName: string): string | null => {
  const pattern = new RegExp(
    `<(?:[\\w.-]+:)?${localName}\\b[^>]*>[\\s\\S]*?<\\/(?:[\\w.-]+:)?${localName}>`,
    "i"
  );
  return xml.match(pattern)?.[0] ?? null;
};

const findIdWithSchemeName = (xml: string): string | null => {
  const match = xml.match(
    /<(?:[\w.-]+:)?ID\b[^>]*\bschemeName=["']([^"']+)["'][^>]*>/i
  );
  return match?.[1]?.trim() || null;
};

const maskDocument = (documentNumber: string): string => {
  if (documentNumber.length <= 6) {
    return "***";
  }
  return `${documentNumber.slice(0, 3)}***${documentNumber.slice(-3)}`;
};

const buildSummary = (
  documentTypeCode: string,
  documentNumberNormalized: string,
  legalName: string,
  fiscalEmail: string
): ResponseSummary => ({
  hasLegalName: Boolean(legalName),
  hasFiscalEmail: Boolean(fiscalEmail),
  documentTypeCode,
  documentNumberMasked: maskDocument(documentNumberNormalized),
});

const soapFaultResult = (
  xml: string,
  input: FiscalLookupInput
): FiscalLookupResult => {
  const faultText =
    findElementText(xml, "faultstring") ||
    findElementText(xml, "Reason") ||
    findElementText(xml, "Text") ||
    "SOAP fault returned by DIAN GetAcquirer fixture";

  return {
    provider: "DIAN_DIRECT",
    partyType: input.partyType,
    documentTypeCode: input.documentTypeCode,
    documentNumberNormalized: input.documentNumberNormalized,
    legalName: "",
    fiscalEmail: "",
    lookupStatus: "ERROR",
    statusCode: "SOAP_FAULT",
    message: faultText,
    responseSummary: buildSummary(
      input.documentTypeCode,
      input.documentNumberNormalized,
      "",
      ""
    ),
  };
};

export const parseGetAcquirerResponse = (
  xml: string,
  input: FiscalLookupInput
): FiscalLookupResult => {
  if (!xml.trim().includes("<") || !findBlock(xml, "Envelope")) {
    throw new Error("Invalid GetAcquirer SOAP XML fixture");
  }

  if (findBlock(xml, "Fault")) {
    return soapFaultResult(xml, input);
  }

  const status = (
    findElementText(xml, "Status") ||
    findElementText(xml, "StatusCode") ||
    ""
  ).toUpperCase();

  if (status === "NOT_FOUND") {
    return {
      provider: "DIAN_DIRECT",
      partyType: input.partyType,
      documentTypeCode: input.documentTypeCode,
      documentNumberNormalized: input.documentNumberNormalized,
      legalName: "",
      fiscalEmail: "",
      lookupStatus: "NOT_FOUND",
      statusCode: "NOT_FOUND",
      message: "DIAN GetAcquirer fixture did not find acquirer",
      responseSummary: buildSummary(
        input.documentTypeCode,
        input.documentNumberNormalized,
        "",
        ""
      ),
    };
  }

  const accountingCustomerParty = findBlock(xml, "AccountingCustomerParty");
  const taxRepresentativeParty = findBlock(xml, "TaxRepresentativeParty");
  const contact = accountingCustomerParty
    ? findBlock(accountingCustomerParty, "Contact")
    : null;

  const documentTypeCode =
    (accountingCustomerParty && findIdWithSchemeName(accountingCustomerParty)) ||
    input.documentTypeCode;
  const documentNumberNormalized =
    (taxRepresentativeParty && findElementText(taxRepresentativeParty, "ID")) ||
    input.documentNumberNormalized;
  const legalName =
    (contact && findElementText(contact, "Name")) ||
    findElementText(xml, "LegalName") ||
    "";
  const fiscalEmail =
    (contact && findElementText(contact, "ElectronicMail")) ||
    findElementText(xml, "FiscalEmail") ||
    "";

  if (!legalName) {
    return {
      provider: "DIAN_DIRECT",
      partyType: input.partyType,
      documentTypeCode,
      documentNumberNormalized,
      legalName: "",
      fiscalEmail,
      lookupStatus: "ERROR",
      statusCode: "MAPPING_INCOMPLETE",
      message: "DIAN GetAcquirer fixture is missing legalName",
      responseSummary: buildSummary(
        documentTypeCode,
        documentNumberNormalized,
        "",
        fiscalEmail
      ),
    };
  }

  return {
    provider: "DIAN_DIRECT",
    partyType: input.partyType,
    documentTypeCode,
    documentNumberNormalized,
    legalName,
    fiscalEmail,
    lookupStatus: "FOUND",
    statusCode: "FOUND",
    message: "DIAN GetAcquirer fixture result",
    responseSummary: buildSummary(
      documentTypeCode,
      documentNumberNormalized,
      legalName,
      fiscalEmail
    ),
  };
};
