import type {
  ElectronicBillingProviderAttachmentResult,
  ElectronicBillingProviderDocumentResult,
  ElectronicBillingProviderOperationsResult,
  ElectronicBillingProviderStatusResult,
  ElectronicBillingProviderContext,
  ElectronicCustomer,
  ElectronicDocumentLineInput,
  ElectronicTaxInput,
  IssueElectronicCreditNoteCommand,
  IssueElectronicInvoiceCommand,
} from "../../contracts/electronic-billing-commands";
import type {
  ElectronicDocumentStatus,
  ElectronicFailureClass,
  ElectronicProviderErrorDetail,
} from "../../domain/electronic-billing.types";
import { FactuCoreConfigurationError } from "./factucore.errors";
import { FACTUCORE_DEFAULT_TIMEOUT_MS } from "./factucore.types";
import type {
  FactuCoreBinaryResponse,
  FactuCoreCreditNoteRequest,
  FactuCoreCustomer,
  FactuCoreDocumentLine,
  FactuCoreDocumentOperationsResponse,
  FactuCoreDocumentResponse,
  FactuCoreInvoiceRequest,
  FactuCoreRuntimeContext,
  FactuCoreStatusResponse,
  FactuCoreTax,
  FactuCoreTaxType,
} from "./factucore.types";

const DOCUMENT_STATUS_MAP: Record<string, ElectronicDocumentStatus> = {
  DRAFT: "PROCESSING",
  VALIDATING: "PROCESSING",
  VALIDATED_INTERNAL: "PROCESSING",
  XML_GENERATED: "PROCESSING",
  SIGNED: "PROCESSING",
  READY_TO_SEND: "PROCESSING",
  SENT: "PROCESSING",
  PENDING_RETRY: "TECHNICAL_ERROR",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  TECHNICAL_ERROR: "TECHNICAL_ERROR",
  CANCELLED_LOGICALLY: "CANCELLED",
};

const IDENTIFICATION_TYPE_MAP: Record<string, string> = {
  "12": "TI",
  "13": "CC",
  "22": "CE",
  "31": "NIT",
  "41": "PASSPORT",
  "42": "FOREIGN_ID",
  "50": "NIT_OTHER_COUNTRY",
};

const normalizeString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const normalizeNullableString = (value: unknown) => {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : null;
};

const FAILURE_CLASSES = new Set<ElectronicFailureClass>([
  "ACCEPTED",
  "PENDING",
  "DIAN_REJECTED",
  "VALIDATION",
  "NETWORK_OR_TRANSIENT",
]);

const MAX_PROVIDER_ERRORS = 50;

export const normalizeFactuCoreFailureClass = (value: unknown): ElectronicFailureClass | null => {
  const normalized = normalizeString(value).toUpperCase() as ElectronicFailureClass;
  return FAILURE_CLASSES.has(normalized) ? normalized : null;
};

export const normalizeFactuCoreProviderErrors = (value: unknown): ElectronicProviderErrorDetail[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): ElectronicProviderErrorDetail | null => {
      if (typeof item === "string") {
        const message = item.trim();
        return message ? { code: null, message: message.slice(0, 1000), path: null, severity: null } : null;
      }
      if (!item || typeof item !== "object") {
        return null;
      }
      const record = item as Record<string, unknown>;
      const message = normalizeNullableString(record.message ?? record.description ?? record.detail);
      if (!message) {
        return null;
      }
      return {
        code: normalizeNullableString(record.code ?? record.errorCode),
        message: message.slice(0, 1000),
        path: normalizeNullableString(record.path ?? record.field),
        severity: normalizeNullableString(record.severity ?? record.level),
      };
    })
    .filter((item): item is ElectronicProviderErrorDetail => item !== null)
    .slice(0, MAX_PROVIDER_ERRORS);
};

type NormalizedFactuCorePaymentMeans = {
  paymentMeansCode: "10" | "45" | "47" | "49";
  paymentMeansId: "1";
};

type NormalizedFactuCorePayment = NormalizedFactuCorePaymentMeans & {
  amount: string;
  reference: string | null;
  requiresReference: boolean;
};

const toCents = (value: unknown, label: string): bigint => {
  const raw = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new FactuCoreConfigurationError("payment_normalization", `${label} must be a positive monetary value`);
  const [whole, fraction = ""] = raw.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents <= 0n) throw new FactuCoreConfigurationError("payment_normalization", `${label} must be a positive monetary value`);
  return cents;
};

const centsToMoney = (value: bigint) => `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;

const normalizePaymentMeans = (
  methodCode: string | null | undefined,
  explicitCode: string | null | undefined,
  explicitId: string | null | undefined,
  electronicBillingEnabled: boolean | null | undefined,
): NormalizedFactuCorePaymentMeans => {
  if (electronicBillingEnabled === false) {
    throw new FactuCoreConfigurationError(
      "payment_normalization",
      "Payment method is disabled for electronic billing",
    );
  }
  if (normalizeString(explicitCode) || normalizeString(explicitId)) {
    if (!["10", "45", "47", "49"].includes(normalizeString(explicitCode)) || normalizeString(explicitId) !== "1") {
      throw new FactuCoreConfigurationError(
        "payment_normalization",
        "Payment method fiscal configuration is invalid",
      );
    }
    return {
      paymentMeansCode: normalizeString(explicitCode) as NormalizedFactuCorePaymentMeans["paymentMeansCode"],
      paymentMeansId: "1",
    };
  }
  const normalizedMethodCode = normalizeString(methodCode).toUpperCase();

  const catalogMapping: Record<string, NormalizedFactuCorePaymentMeans> = {
    "001": { paymentMeansCode: "10", paymentMeansId: "1" },
    "002": { paymentMeansCode: "47", paymentMeansId: "1" },
    "003": { paymentMeansCode: "49", paymentMeansId: "1" },
    "QR_BREB": { paymentMeansCode: "45", paymentMeansId: "1" },
  };
  const mapped = catalogMapping[normalizedMethodCode];
  if (mapped) {
    return mapped;
  }

  if (normalizedMethodCode === "CASH" || normalizedMethodCode === "10") {
    return {
      paymentMeansCode: "10",
      paymentMeansId: "1",
    };
  }

  throw new FactuCoreConfigurationError(
    "payment_normalization",
    `Payment method ${normalizedMethodCode || "UNKNOWN"} is not mapped to the FactuCore fiscal contract`,
  );
};

const calculateFactuCoreLineTotal = (line: FactuCoreDocumentLine): number => {
  const qty = Number(line.quantity);
  const unitPrice = Number(line.unitPrice);
  const discount = Number(line.discountAmount ?? 0);
  const lineBase = Math.round((qty * unitPrice - discount) * 100) / 100;
  const lineTax = (line.taxes ?? []).reduce((sum, tax) => {
    const rate = Number(tax.rate);
    return sum + calculateDianTaxAmount(lineBase, rate);
  }, 0);
  return Math.round((lineBase + Math.round(lineTax * 100) / 100) * 100) / 100;
};

const normalizeCommandPayments = (
  command: IssueElectronicInvoiceCommand | IssueElectronicCreditNoteCommand,
  lines?: FactuCoreDocumentLine[],
): NormalizedFactuCorePayment[] => {
  const legacy = command.payment ?? null;
  const source = command.payments ?? (legacy ? [legacy] : []);
  if (!source.length) {
    throw new FactuCoreConfigurationError("payment_normalization", "At least one payment is required");
  }
  if (command.payments && legacy && command.payments.length !== 1) {
    throw new FactuCoreConfigurationError("payment_normalization", "payment and payments cannot be supplied together");
  }

  let total: bigint;
  if (lines && lines.length > 0) {
    const lineTotalSum = lines.reduce((sum, line) => sum + calculateFactuCoreLineTotal(line), 0);
    total = BigInt(Math.round(lineTotalSum * 100));
  } else {
    total = toCents(command.totals.totalAmount, "invoice total");
  }

  const normalized = source.map((payment) => {
    const metadata = payment.metadata ?? {};
    const means = normalizePaymentMeans(
      payment.methodCode,
      payment.paymentMeansCode ?? (typeof metadata.electronicPaymentMeansCode === "string" ? metadata.electronicPaymentMeansCode : null),
      payment.paymentMeansId ?? (typeof metadata.electronicPaymentMeansId === "string" ? metadata.electronicPaymentMeansId : null),
      typeof metadata.electronicBillingEnabled === "boolean" ? metadata.electronicBillingEnabled : null,
    );
    const rawAmount = payment.amount ?? metadata.amount ?? (source.length === 1 ? centsToMoney(total) : null);
    const reference = normalizeNullableString(payment.reference ?? metadata.reference);
    const requiresReference = payment.requiresReference ?? metadata.requiresReference === true;
    if (requiresReference && !reference) {
      throw new FactuCoreConfigurationError("payment_normalization", `Payment reference is required for ${means.paymentMeansCode}`);
    }
    return {
      ...means,
      amount: source.length === 1 ? centsToMoney(total) : centsToMoney(toCents(rawAmount, "payment amount")),
      reference,
      requiresReference,
    };
  });

  const allocated = normalized.reduce((sum, payment) => sum + toCents(payment.amount, "payment amount"), 0n);
  if (allocated !== total) {
    const diff = total - allocated;
    if (diff >= -5n && diff <= 5n && normalized.length > 0) {
      const adjustedCents = toCents(normalized[0].amount, "payment amount") + diff;
      normalized[0].amount = centsToMoney(adjustedCents);
    } else {
      throw new FactuCoreConfigurationError("payment_normalization", `Payment allocation total ${centsToMoney(allocated)} does not equal invoice total ${centsToMoney(total)}`);
    }
  }

  if (command.payments && legacy && normalized.length === 1) {
    const legacyMeans = normalizePaymentMeans(legacy.methodCode, typeof legacy.metadata?.electronicPaymentMeansCode === "string" ? legacy.metadata.electronicPaymentMeansCode : null, typeof legacy.metadata?.electronicPaymentMeansId === "string" ? legacy.metadata.electronicPaymentMeansId : null, null);
    if (legacyMeans.paymentMeansCode !== normalized[0].paymentMeansCode || legacyMeans.paymentMeansId !== normalized[0].paymentMeansId) {
      throw new FactuCoreConfigurationError("payment_normalization", "payment and payments conflict");
    }
  }
  return normalized;
};

const mapUnitCode = (value: string | null | undefined) => value === "UNIT" || value === "UND" || !value ? "EA" : value;

const toIsoString = (value: string | Date | null | undefined) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const toDateOnlyString = (value: string | Date | null | undefined) => {
  const iso = toIsoString(value);
  if (!iso) {
    return null;
  }
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
};

const resolveIdentificationType = (typeCode: string | null | undefined) => {
  if (!typeCode) {
    return null;
  }

  return IDENTIFICATION_TYPE_MAP[typeCode] ?? null;
};

const resolveCustomerType = (customer: ElectronicCustomer) => {
  if (customer.customerType) {
    return customer.customerType;
  }

  const resolved = resolveIdentificationType(customer.identification.typeCode);
  return resolved === "NIT" || resolved === "NIT_OTHER_COUNTRY" ? "COMPANY" : "PERSON";
};

const resolveCustomerPartyTaxScheme = (customer: ElectronicCustomer) => {
  const raw = normalizeString(customer.taxProfile?.taxScheme).toUpperCase();
  const canonical = {
    "01": { taxSchemeId: "01", taxSchemeName: "IVA" },
    IVA: { taxSchemeId: "01", taxSchemeName: "IVA" },
    "04": { taxSchemeId: "04", taxSchemeName: "INC" },
    INC: { taxSchemeId: "04", taxSchemeName: "INC" },
    ZA: { taxSchemeId: "ZA", taxSchemeName: "IVA e INC" },
    ZZ: { taxSchemeId: "ZZ", taxSchemeName: "No aplica" },
    "NO APLICA": { taxSchemeId: "ZZ", taxSchemeName: "No aplica" },
  }[raw as "01" | "IVA" | "04" | "INC" | "ZA" | "ZZ" | "NO APLICA"];

  if (canonical) {
    return canonical;
  }

  // Manus tax-regime labels are not DIAN PartyTaxScheme codes. Keep the
  // explicit non-VAT case as ZZ; the remaining supported regimes use the
  // existing customer-type fallback and are never sent as raw scheme codes.
  if (raw === "NO_RESPONSABLE") {
    return { taxSchemeId: "ZZ", taxSchemeName: "No aplica" };
  }

  if (
    !raw ||
    raw === "ORDINARIO" ||
    raw === "SIMPLE" ||
    raw === "ESPECIAL" ||
    raw === "NATURAL" ||
    raw === "JURIDICA" ||
    raw === "R-99-PN"
  ) {
    return resolveCustomerType(customer) === "PERSON"
      ? { taxSchemeId: "ZZ", taxSchemeName: "No aplica" }
      : { taxSchemeId: "01", taxSchemeName: "IVA" };
  }

  throw new FactuCoreConfigurationError(
    "customer_tax_scheme_normalization",
    "Customer TaxScheme is not a valid DIAN ID/name pair",
  );
};

const resolveCustomerLegalName = (customer: ElectronicCustomer) => {
  const legalName = normalizeString(customer.legalName);
  if (legalName.length > 0) {
    return legalName;
  }

  const names = [customer.firstName, customer.lastName].map(normalizeString).filter(Boolean);
  return names.join(" ").trim();
};

const normalizeTaxLabel = (value: unknown) => normalizeString(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, "_")
  .replace(/^_|_$/g, "");

const TAX_TYPE_ALIASES: Record<string, FactuCoreTaxType> = {
  IVA: "IVA",
  VAT: "IVA",
  IVA_0: "IVA",
  IVA_5: "IVA",
  IVA_19: "IVA",
  INC: "INC",
  IMPUESTO_NACIONAL_AL_CONSUMO: "INC",
  IMPUESTO_AL_CONSUMO: "INC",
  NATIONAL_CONSUMPTION: "INC",
  BEER_CONSUMPTION: "INC",
  IMPUESTO_AL_CONSUMO_DE_CERVEZAS_Y_REFAJOS: "INC",
  IMPUESTO_AL_CONSUMO_DE_LICORES: "ICL",
  LIQUOR_CONSUMPTION: "ICL",
  ICL: "ICL",
  ICA: "ICA",
  IMPUESTO_DE_INDUSTRIA_Y_COMERCIO: "ICA",
  INDUSTRIA_Y_COMERCIO: "ICA",
  // Ad-valorem is a distinct DIAN TaxScheme (36) in the liquor contract.
  // Do not collapse it into INC (04), because FactuCore uses 36 to derive
  // the DANE-certified retail-price base deterministically.
  AD_VALOREM: "ADV",
  ADV: "ADV",
  RETE_FUENTE: "RETE_FUENTE",
  RETENCION_EN_LA_FUENTE: "RETE_FUENTE",
  RETENCION_FUENTE: "RETE_FUENTE",
  RETE_IVA: "RETE_IVA",
  RETENCION_DE_IVA: "RETE_IVA",
  RETENCION_IVA: "RETE_IVA",
  RETE_ICA: "RETE_ICA",
  RETENCION_DE_ICA: "RETE_ICA",
  RETENCION_ICA: "RETE_ICA",
  OTHER: "OTHER",
  OTRO: "OTHER",
  EXENTO: "OTHER",
  EXCLUIDO: "OTHER",
  NO_APLICA: "OTHER",
};

export const mapFactuCoreTaxType = (tax: ElectronicTaxInput): FactuCoreTaxType => {
  const candidates = [
    tax.type,
    tax.schemeName,
    tax.metadata?.taxType,
    tax.metadata?.taxSchemeName,
  ];

  for (const candidate of candidates) {
    const mapped = TAX_TYPE_ALIASES[normalizeTaxLabel(candidate)];
    if (mapped) {
      return mapped;
    }
  }

  throw new FactuCoreConfigurationError(
    "tax_normalization",
    "Tax type is not mapped to the FactuCore fiscal contract",
  );
};

export type FactuCoreTaxTreatment = "TAXED" | "EXCLUDED" | "NOT_APPLICABLE";

export const mapFactuCoreTaxTreatment = (
  value: string | null | undefined,
): FactuCoreTaxTreatment | null => {
  const normalized = normalizeString(value).toUpperCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "EXEMPT") {
    return "NOT_APPLICABLE";
  }
  if (normalized === "EXCLUDED") {
    return "EXCLUDED";
  }
  if (normalized === "TAXED") {
    return "TAXED";
  }

  throw new FactuCoreConfigurationError(
    "tax_treatment_normalization",
    `Tax treatment is not mapped to the FactuCore fiscal contract: ${value}`,
  );
};

const FACTUCORE_TAX_SCHEME_IDS: Partial<Record<FactuCoreTaxType, string>> = {
  IVA: "01",
  INC: "04",
  ICL: "32",
  ADV: "36",
  ICA: "03",
};

const mapFactuCoreTaxSchemeId = (tax: ElectronicTaxInput) => {
  const taxType = mapFactuCoreTaxType(tax);
  const canonicalId = FACTUCORE_TAX_SCHEME_IDS[taxType];
  if (canonicalId) {
    return canonicalId;
  }

  const suppliedId = normalizeNullableString(tax.schemeId);
  return suppliedId === "01" || suppliedId === "04" || suppliedId === "03"
    ? suppliedId
    : null;
};

const resolveTaxProfile = (customer: ElectronicCustomer) => {
  const identificationTypeCode = normalizeString(customer.taxProfile?.identificationTypeCode) || normalizeString(customer.identification.typeCode);
  const partyTaxScheme = resolveCustomerPartyTaxScheme(customer);
  const liabilityCode = normalizeNullableString(customer.taxProfile?.liabilityTypeCode);
  const fiscalResponsibilityCodes = customer.taxProfile?.fiscalResponsibilityCodes?.filter((code) => normalizeString(code).length > 0) ?? null;

  return {
    identificationTypeCode,
    taxSchemeId: partyTaxScheme.taxSchemeId,
    taxSchemeName: partyTaxScheme.taxSchemeName,
    liabilityCode,
    fiscalResponsibilityCodes,
  };
};

const mapCustomer = (customer: ElectronicCustomer): FactuCoreCustomer => {
  const taxProfile = resolveTaxProfile(customer);
  const identificationType = resolveIdentificationType(customer.identification.typeCode);

  return {
    customerType: resolveCustomerType(customer),
    identificationType,
    identificationTypeCode: taxProfile.identificationTypeCode || customer.identification.typeCode || "31",
    identificationNumber: customer.identification.number,
    verificationDigit: customer.identification.verificationDigit ?? null,
    legalName: resolveCustomerLegalName(customer),
    tradeName: normalizeNullableString(customer.metadata?.tradeName),
    firstName: normalizeNullableString(customer.firstName),
    middleName: normalizeNullableString(customer.metadata?.middleName),
    familyName: normalizeNullableString(customer.lastName),
    secondFamilyName: normalizeNullableString(customer.metadata?.secondLastName),
    taxLevelCode: taxProfile.liabilityCode,
    taxSchemeId: taxProfile.taxSchemeId,
    taxSchemeName: taxProfile.taxSchemeName,
    fiscalResponsibilityCode: taxProfile.fiscalResponsibilityCodes?.[0] ?? null,
    fiscalResponsibilityCodes: taxProfile.fiscalResponsibilityCodes,
    fiscalResponsibilities: taxProfile.fiscalResponsibilityCodes,
    email: normalizeNullableString(customer.email),
    phone: normalizeNullableString(customer.phone),
    addressLine1: normalizeNullableString(customer.address),
    countryCode: "CO",
    departmentCode: normalizeNullableString(
      customer.metadata?.departmentCode ?? customer.departmentCode,
    ),
    municipalityCode: normalizeNullableString(
      customer.municipalityCode ?? customer.metadata?.municipalityCode,
    ),
    cityName: normalizeNullableString(customer.metadata?.cityName),
    departmentName: normalizeNullableString(customer.metadata?.departmentName),
    countryName: normalizeNullableString(customer.metadata?.countryName),
    postalZone: normalizeNullableString(customer.metadata?.postalZone),
    taxRegime: normalizeNullableString(customer.metadata?.taxRegime),
    merchantRegistration: normalizeNullableString(customer.metadata?.merchantRegistration),
  };
};

const calculateDianTaxAmount = (taxableBase: number, ratePercent: number): number => {
  const baseCents = BigInt(Math.round(taxableBase * 100));
  const rateUnits = BigInt(Math.round(ratePercent * 10000));
  const denominator = 10_000n * 100n;
  const numerator = baseCents * rateUnits;
  const cents = (numerator + denominator / 2n) / denominator;
  return Number(cents) / 100;
};

const mapTax = (tax: ElectronicTaxInput): FactuCoreTax => {
  const taxType = mapFactuCoreTaxType(tax);
  const taxSchemeId = mapFactuCoreTaxSchemeId(tax);
  const normalizedRate = Number(tax.rate);
  if (!Number.isFinite(normalizedRate) || normalizedRate < 0) {
    throw new FactuCoreConfigurationError("tax_rate_normalization", "Tax rate is not a valid non-negative number");
  }
  const rate = normalizedRate > 0 && normalizedRate < 1 ? normalizedRate * 100 : normalizedRate;
  const taxableBase = Number(tax.taxableBase);
  const taxAmount = Number.isFinite(taxableBase) && Number.isFinite(rate)
    ? calculateDianTaxAmount(taxableBase, rate)
    : Number(tax.amount);

  return {
    taxType,
    taxSchemeId,
    taxSchemeName: taxType,
    // Manus pricing stores 0.19; DIAN UBL Percent requires 19.
    rate,
    taxableBase: tax.taxableBase,
    taxAmount,
    metadata: {
      ...(tax.metadata ?? {}),
      ...(tax.code ? { taxCode: tax.code } : {}),
      ...(taxSchemeId ? { taxSchemeId } : {}),
      taxSchemeName: taxType,
    },
  };
};

const mapLine = (line: ElectronicDocumentLineInput): FactuCoreDocumentLine => {
  const taxTreatment = mapFactuCoreTaxTreatment(line.taxTreatment);
  return {
    sku: normalizeNullableString(line.sku),
    originLineId: normalizeNullableString(line.providerOriginalLineId ?? line.originalElectronicDocumentLineId ?? line.sourceLineId),
    standardItemId: normalizeNullableString(line.standardItemId),
    standardItemSchemeId: normalizeNullableString(line.standardItemSchemeId),
    description: line.description,
    unitCode: mapUnitCode(line.unitCode),
    taxTreatment,
    beverageCategory: line.beverageCategory ?? null,
    volumeMilliliters: line.volumeMilliliters ?? null,
    alcoholDegrees: line.alcoholDegrees ?? null,
    publicSalePriceBeforeTaxes: line.publicSalePriceBeforeTaxes ?? null,
    taxSchemeId: line.taxes?.length === 1 ? mapFactuCoreTaxSchemeId(line.taxes[0]) : null,
    taxSchemeName: line.taxes?.length === 1 ? mapFactuCoreTaxType(line.taxes[0]) : null,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountAmount: line.discountAmount ?? null,
    taxes: taxTreatment === "EXCLUDED" || taxTreatment === "NOT_APPLICABLE"
      ? undefined
      : line.taxes?.map(mapTax),
    metadata: line.metadata ?? {},
  };
};

const resolveFactuCoreIssueDate = (issueDate?: string | Date | null): string => {
  const now = new Date();
  if (!issueDate) {
    return now.toISOString();
  }
  const iso = toIsoString(issueDate);
  if (!iso) {
    return now.toISOString();
  }
  try {
    const bogotaFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" });
    const todayBogota = bogotaFormatter.format(now);
    const issueBogota = bogotaFormatter.format(new Date(iso));
    if (issueBogota !== todayBogota) {
      return now.toISOString();
    }
  } catch {
    // If timezone formatting fails, return iso
  }
  return iso;
};

/** DIAN IssueTime must be the real emission time, not the midnight of a DATE column. */
export const resolveFactuCoreIssueTime = (issueTime?: string | null, now: Date = new Date()): string => {
  const explicit = issueTime?.trim();
  if (explicit && /^\d{2}:\d{2}(?::\d{2})?/.test(explicit)) {
    return explicit.slice(0, 8);
  }
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now);
};

const buildBaseRequest = (
  command: IssueElectronicInvoiceCommand | IssueElectronicCreditNoteCommand,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => {
  const lines = command.lines.map(mapLine);
  const payments = normalizeCommandPayments(command, lines);

  return {
    externalReference: command.externalReference,
    issueDate: resolveFactuCoreIssueDate(command.issueDate),
    issueTime: resolveFactuCoreIssueTime(command.issueTime),
    payments,
    lines,
    metadata: command.metadata ?? {},
    ...overrides,
  };
};

export class FactuCoreMapper {
  buildRuntimeContext(context: ElectronicBillingProviderContext, credentials: { clientKey: string; clientSecret: string }): FactuCoreRuntimeContext {
    const timeoutFromSettings = this.resolveTimeoutMs(context.settings);
    return {
      baseUrl: context.baseUrl ?? "",
      credentials,
      timeoutMs: timeoutFromSettings ?? FACTUCORE_DEFAULT_TIMEOUT_MS,
    };
  }

  buildInvoiceRequest(command: IssueElectronicInvoiceCommand): FactuCoreInvoiceRequest {
    return {
      ...buildBaseRequest(command),
      customer: mapCustomer(command.customer),
      invoiceTypeCode: "01",
      operationType: "10",
      references: [],
    } as unknown as FactuCoreInvoiceRequest;
  }

  buildCreditNoteRequest(command: IssueElectronicCreditNoteCommand): FactuCoreCreditNoteRequest {
    const original = command.originalDocument;

    return {
      ...buildBaseRequest(command, {}),
      customerId: null,
      originDocumentId: original.providerDocumentId ?? null,
      originFullNumber: original.fullNumber ?? null,
      originExternalReference: original.externalReference ?? null,
      discrepancyResponseCode: command.reason.reasonCode ?? null,
      discrepancyResponseDescription: command.reason.reasonDescription ?? null,
      noteReason: command.reason.reasonDescription ?? command.reason.reasonType ?? null,
      invoiceTypeCode: "20",
      operationType: "20",
      references: [],
    } as unknown as FactuCoreCreditNoteRequest;
  }

  mapDocumentResult(
    documentId: string,
    response: FactuCoreDocumentResponse | FactuCoreStatusResponse,
    fallbackStatus?: string | null,
  ): ElectronicBillingProviderDocumentResult {
    const providerStatus = normalizeString(response.providerStatus ?? response.status ?? fallbackStatus ?? "SENT") || "SENT";
    const normalizedStatus = this.normalizeStatus(
      providerStatus,
      typeof response.normalizedStatus === "string" ? response.normalizedStatus : null,
    );
    const lineResults = Array.isArray(response.lines)
      ? response.lines.map((line, index) => ({
          index,
          providerLineId: normalizeNullableString(line?.id ?? line?.providerLineId),
          originLineId: normalizeNullableString(line?.originLineId),
          lineNumber: line?.lineNumber ?? null,
        }))
      : null;
    return {
      documentId,
      providerDocumentId: normalizeNullableString(response.providerDocumentId ?? response.id ?? response.documentId),
      providerStatus,
      normalizedStatus,
      providerStatusDetail: normalizeNullableString(response.providerStatusDetail ?? response.statusDetail ?? response.message),
      prefix: normalizeNullableString(response.prefix),
      number: response.number ?? null,
      fullNumber: normalizeNullableString(response.fullNumber),
      cufe: normalizeNullableString(response.cufe),
      cude: normalizeNullableString(response.cude),
      acceptedAt: response.acceptedAt ?? null,
      rejectedAt: response.rejectedAt ?? null,
      providerStatusCode: normalizeNullableString(response.providerStatusCode),
      providerStatusMessage: normalizeNullableString(response.providerStatusMessage),
      trackingId: normalizeNullableString(response.trackingId),
      failureClass: normalizeFactuCoreFailureClass(response.failureClass),
      failureReason: normalizeNullableString(response.reason),
      probableCause: normalizeNullableString(response.probableCause),
      providerErrors: normalizeFactuCoreProviderErrors(response.errors),
      graphicRepresentation:
        response.graphicRepresentation &&
        typeof response.graphicRepresentation === "object" &&
        !Array.isArray(response.graphicRepresentation)
          ? response.graphicRepresentation
          : null,
      metadata: {
        ...(response.metadata ?? {}),
        ...(lineResults ? { lineResults } : {}),
      } as Record<string, unknown>,
    };
  }

  mapStatusResult(
    documentId: string,
    response: FactuCoreStatusResponse,
  ): ElectronicBillingProviderStatusResult {
    const providerStatus = normalizeString(response.providerStatus ?? response.status ?? "SENT") || "SENT";
    return {
      ...this.mapDocumentResult(documentId, response, providerStatus),
      providerStatus,
      normalizedStatus: this.normalizeStatus(
        providerStatus,
        typeof response.normalizedStatus === "string" ? response.normalizedStatus : null,
      ),
      providerStatusCode: normalizeNullableString(response.providerStatusCode),
      providerStatusMessage: normalizeNullableString(response.providerStatusMessage),
      trackingId: normalizeNullableString(response.trackingId),
      errorCode: normalizeNullableString(response.errorCode),
      errorMessage: normalizeNullableString(response.errorMessage),
    };
  }

  mapOperationsResult(
    documentId: string,
    response: FactuCoreDocumentOperationsResponse,
  ): ElectronicBillingProviderOperationsResult {
    const availableActions = Array.isArray(response.availableActions)
      ? response.availableActions
          .filter((action) => typeof action === "string" && action.trim().length > 0)
          .map((action) => action.trim())
      : [];

    return {
      documentId,
      providerDocumentId: normalizeNullableString(response.providerDocumentId ?? response.documentId),
      providerStatus: normalizeNullableString(response.status),
      normalizedStatus: response.status ? this.normalizeStatus(response.status) : null,
      currentStep: normalizeNullableString(response.currentStep),
      availableActions,
      artifactsAvailable: response.artifactsAvailable ?? null,
      latestTransmission: response.latestTransmission ?? null,
      metadata: response.metadata ?? {},
    };
  }

  mapAttachmentResult(
    documentId: string,
    attachmentType: "XML" | "SIGNED_XML" | "PDF" | "PROVIDER_RESPONSE",
    response: FactuCoreBinaryResponse,
  ): ElectronicBillingProviderAttachmentResult {
    return {
      documentId,
      providerDocumentId: null,
      attachmentType,
      providerAttachmentId: response.providerAttachmentId,
      content: response.content,
      fileName: response.fileName,
      mimeType: response.contentType,
      storageProvider: "factucore",
      storageKey: null,
      checksum: null,
      sizeBytes: response.sizeBytes,
      metadata: {},
    };
  }

  normalizeStatus(
    providerStatus: string,
    normalizedStatus?: string | ElectronicDocumentStatus | null,
  ): ElectronicDocumentStatus {
    if (normalizedStatus) {
      return normalizedStatus as ElectronicDocumentStatus;
    }

    const mapped = DOCUMENT_STATUS_MAP[providerStatus.toUpperCase()];
    return mapped ?? "PROCESSING";
  }

  resolveTimeoutMs(settings: Record<string, unknown>) {
    const raw = settings.factucoreTimeoutMs ?? settings.timeoutMs;
    if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) {
      return raw;
    }

    return undefined;
  }
}
