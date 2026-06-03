import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import crypto from "crypto";
import { ElectronicInvoicingCustomersRepository } from "./electronic-invoicing-customers.repository";
import type { CreateElectronicInvoicingCustomerDto } from "./dto/create-electronic-invoicing-customer.dto";
import type { ListElectronicInvoicingCustomersDto } from "./dto/list-electronic-invoicing-customers.dto";
import type { UpdateElectronicInvoicingCustomerDto } from "./dto/update-electronic-invoicing-customer.dto";
import type {
  CreateElectronicInvoicingCustomerInput,
  DianLastLookupStatus,
  FiscalDataSource,
  FiscalStatus,
  ListElectronicInvoicingCustomersFilters,
  PersonType,
  UpdateElectronicInvoicingCustomerInput,
} from "./electronic-invoicing-customer.types";

type PgErrorLike = {
  code?: string;
  constraint?: string;
};

const VALID_FISCAL_STATUSES = new Set<FiscalStatus>([
  "PENDING",
  "VALIDATED",
  "FAILED",
  "NOT_REQUIRED",
]);

const VALID_LOOKUP_STATUSES = new Set<DianLastLookupStatus>([
  "PENDING",
  "FOUND",
  "NOT_FOUND",
  "ERROR",
  "SKIPPED",
]);

const VALID_FISCAL_DATA_SOURCES = new Set<FiscalDataSource>([
  "MANUAL",
  "MOCK_LOCAL",
  "DIAN_DIRECT",
  "TECH_PROVIDER",
  "RUT",
  "UNKNOWN",
]);

const VALID_PERSON_TYPES = new Set<PersonType>([
  "NATURAL",
  "JURIDICA",
  "UNKNOWN",
]);

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_FINAL_CONSUMER_NAME = "Consumidor Final";

const hasOwn = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

export const normalizeFiscalDocument = (value?: string | null): string | null => {
  const normalized = value?.trim().toUpperCase().replace(/[^0-9A-Z]/g, "") ?? "";
  return normalized.length > 0 ? normalized : null;
};

@Injectable()
export class ElectronicInvoicingCustomersService {
  constructor(
    @Inject(ElectronicInvoicingCustomersRepository)
    private readonly customersRepository: ElectronicInvoicingCustomersRepository
  ) {}

  private parseBoolean(value: unknown, fieldName: string): boolean | undefined {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") {
        return true;
      }
      if (normalized === "false") {
        return false;
      }
    }
    throw new BadRequestException(`${fieldName} must be true or false`);
  }

  private normalizeText(value?: string | null): string | null {
    const normalized = value?.trim() ?? "";
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeFiscalEmail(value?: string | null): string | null {
    const email = this.normalizeText(value)?.toLowerCase() ?? null;
    if (email && !BASIC_EMAIL_REGEX.test(email)) {
      throw new BadRequestException("fiscalEmail is invalid");
    }
    return email;
  }

  private normalizeFiscalStatus(value?: FiscalStatus | null): FiscalStatus | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (!VALID_FISCAL_STATUSES.has(value)) {
      throw new BadRequestException("fiscalStatus is invalid");
    }
    return value;
  }

  private normalizeLookupStatus(
    value?: DianLastLookupStatus | null
  ): DianLastLookupStatus | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    if (!VALID_LOOKUP_STATUSES.has(value)) {
      throw new BadRequestException("dianLastLookupStatus is invalid");
    }
    return value;
  }

  private normalizeFiscalDataSource(
    value?: FiscalDataSource | null
  ): FiscalDataSource | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (!VALID_FISCAL_DATA_SOURCES.has(value)) {
      throw new BadRequestException("fiscalDataSource is invalid");
    }
    return value;
  }

  private normalizePersonType(value?: PersonType | null): PersonType | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    if (!VALID_PERSON_TYPES.has(value)) {
      throw new BadRequestException("personType is invalid");
    }
    return value;
  }

  private normalizeTimestamp(value?: string | Date | null): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || value === "") {
      return null;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("dianLastLookupAt is invalid");
    }
    return date;
  }

  private normalizeTaxResponsibilities(value?: string[] | null): string[] | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return [];
    }
    if (!Array.isArray(value)) {
      throw new BadRequestException("taxResponsibilities must be an array");
    }
    return value.map((item) => {
      const normalized = this.normalizeText(item);
      if (!normalized) {
        throw new BadRequestException("taxResponsibilities must not contain empty values");
      }
      return normalized;
    });
  }

  private normalizeDianMetadata(
    value?: Record<string, unknown> | null
  ): Record<string, unknown> | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return {};
    }
    if (Array.isArray(value) || typeof value !== "object") {
      throw new BadRequestException("dianMetadata must be an object");
    }
    return value;
  }

  private resolveTextAliases(
    primary: string | null | undefined,
    alias: string | null | undefined,
    primaryName: string,
    aliasName: string
  ) {
    const normalizedPrimary = this.normalizeText(primary);
    const normalizedAlias = this.normalizeText(alias);
    if (
      normalizedPrimary &&
      normalizedAlias &&
      normalizedPrimary !== normalizedAlias
    ) {
      throw new BadRequestException(`${primaryName} must match ${aliasName}`);
    }
    return normalizedPrimary ?? normalizedAlias;
  }

  private resolveEmailAliases(
    primary: string | null | undefined,
    alias: string | null | undefined
  ) {
    const normalizedPrimary = this.normalizeFiscalEmail(primary);
    const normalizedAlias = this.normalizeFiscalEmail(alias);
    if (
      normalizedPrimary &&
      normalizedAlias &&
      normalizedPrimary !== normalizedAlias
    ) {
      throw new BadRequestException("fiscalEmail must match invoiceEmail");
    }
    return normalizedPrimary ?? normalizedAlias;
  }

  private resolveDocumentNumberAliases(
    documentNumber: string | null | undefined,
    identificationNumber: string | null | undefined
  ) {
    const normalizedDocumentNumber = normalizeFiscalDocument(documentNumber);
    const normalizedIdentificationNumber =
      normalizeFiscalDocument(identificationNumber);
    if (
      normalizedDocumentNumber &&
      normalizedIdentificationNumber &&
      normalizedDocumentNumber !== normalizedIdentificationNumber
    ) {
      throw new BadRequestException(
        "documentNumber must match identificationNumber"
      );
    }
    return normalizedDocumentNumber ?? normalizedIdentificationNumber;
  }

  private buildFilters(
    query: ListElectronicInvoicingCustomersDto
  ): ListElectronicInvoicingCustomersFilters {
    const fiscalStatus = this.normalizeFiscalStatus(query.fiscalStatus);
    return {
      search: this.normalizeText(query.search) ?? undefined,
      documentTypeCode: this.normalizeText(query.documentTypeCode) ?? undefined,
      documentNumber:
        normalizeFiscalDocument(query.documentNumber) ??
        this.normalizeText(query.documentNumber) ??
        undefined,
      isFinalConsumer: this.parseBoolean(
        query.isFinalConsumer,
        "isFinalConsumer"
      ),
      isDianValidated: this.parseBoolean(
        query.isDianValidated,
        "isDianValidated"
      ),
      fiscalDataSource: this.normalizeFiscalDataSource(query.fiscalDataSource),
      fiscalStatus,
      isActive: this.parseBoolean(query.isActive, "isActive"),
    };
  }

  private async ensureNoDuplicateIdentity(
    tenantId: string,
    documentTypeCode: string | null,
    identificationNumber: string | null,
    excludeCustomerId?: string
  ) {
    if (!identificationNumber) {
      return;
    }

    const duplicate = documentTypeCode
      ? await this.customersRepository.findByFiscalIdentity(
          tenantId,
          documentTypeCode,
          identificationNumber,
          excludeCustomerId
        )
      : await this.customersRepository.findByNormalizedDocument(
          tenantId,
          identificationNumber,
          excludeCustomerId
        );

    if (duplicate) {
      throw new ConflictException("fiscal identity already exists for tenant");
    }
  }

  private async ensureNoOtherFinalConsumer(
    tenantId: string,
    excludeCustomerId?: string
  ) {
    const current = await this.customersRepository.findActiveFinalConsumer(
      tenantId,
      excludeCustomerId
    );
    if (current) {
      throw new ConflictException("final consumer already exists for tenant");
    }
  }

  private isFinalConsumerUniqueError(error: unknown) {
    const pgError = error as PgErrorLike;
    return (
      pgError?.code === "23505" &&
      (pgError.constraint === "ux_customers_tenant_active_final_consumer" ||
        pgError.constraint === "ux_customers_tenant_default")
    );
  }

  private isFiscalIdentityUniqueError(error: unknown) {
    const pgError = error as PgErrorLike;
    return (
      pgError?.code === "23505" &&
      pgError.constraint === "ux_customers_tenant_fiscal_identity_fe_3_2"
    );
  }

  listCustomers(tenantId: string, query: ListElectronicInvoicingCustomersDto) {
    return this.customersRepository.listByTenant(
      tenantId,
      this.buildFilters(query)
    );
  }

  async getCustomer(id: string, tenantId: string) {
    const customer = await this.customersRepository.findById(id, tenantId);
    if (!customer) {
      throw new NotFoundException("customer not found");
    }
    return customer;
  }

  async createCustomer(
    tenantId: string,
    dto: CreateElectronicInvoicingCustomerDto
  ) {
    const isFinalConsumer = dto.isFinalConsumer ?? false;
    const name =
      this.normalizeText(dto.name) ??
      (isFinalConsumer ? DEFAULT_FINAL_CONSUMER_NAME : null);

    if (!name) {
      throw new BadRequestException("name is required");
    }

    const documentTypeCode = this.resolveTextAliases(
      dto.documentTypeCode,
      dto.dianIdentificationType,
      "documentTypeCode",
      "dianIdentificationType"
    );
    const identificationNumber = this.resolveDocumentNumberAliases(
      dto.documentNumber,
      dto.identificationNumber
    );
    const documentNumber =
      this.normalizeText(dto.documentNumber) ?? identificationNumber;
    const invoiceEmail = this.resolveEmailAliases(
      dto.fiscalEmail,
      dto.invoiceEmail
    );
    const fiscalStatus =
      this.normalizeFiscalStatus(dto.fiscalStatus) ??
      (isFinalConsumer ? "NOT_REQUIRED" : "PENDING");

    await this.ensureNoDuplicateIdentity(
      tenantId,
      documentTypeCode,
      identificationNumber
    );
    if (isFinalConsumer && (dto.isActive ?? true)) {
      await this.ensureNoOtherFinalConsumer(tenantId);
    }

    const input: CreateElectronicInvoicingCustomerInput = {
      id: crypto.randomUUID(),
      tenantId,
      name,
      documentNumber,
      documentTypeCode,
      documentNumberNormalized: identificationNumber,
      dianIdentificationType: documentTypeCode,
      identificationNumber,
      verificationDigit: this.normalizeText(dto.verificationDigit),
      legalName: this.normalizeText(dto.legalName),
      tradeName: this.normalizeText(dto.tradeName) ?? name,
      fiscalEmail: invoiceEmail,
      invoiceEmail,
      phone: this.normalizeText(dto.phone),
      address: this.normalizeText(dto.address),
      countryCode: this.normalizeText(dto.countryCode),
      departmentCode: this.normalizeText(dto.departmentCode),
      municipalityCode: this.normalizeText(dto.municipalityCode),
      personType: this.normalizePersonType(dto.personType) ?? null,
      taxRegime: this.normalizeText(dto.taxRegime),
      taxResponsibilities: this.normalizeTaxResponsibilities(
        dto.taxResponsibilities
      ) ?? [],
      isFinalConsumer,
      isDianValidated: dto.isDianValidated ?? fiscalStatus === "VALIDATED",
      dianLastLookupAt: this.normalizeTimestamp(dto.dianLastLookupAt) ?? null,
      dianLastLookupStatus: this.normalizeLookupStatus(
        dto.dianLastLookupStatus
      ) ?? null,
      dianMetadata: this.normalizeDianMetadata(dto.dianMetadata) ?? {},
      fiscalDataSource:
        this.normalizeFiscalDataSource(dto.fiscalDataSource) ?? "MANUAL",
      fiscalStatus,
      isActive: dto.isActive ?? true,
    };

    try {
      return await this.customersRepository.create(input);
    } catch (error) {
      if (this.isFinalConsumerUniqueError(error)) {
        throw new ConflictException("final consumer already exists for tenant");
      }
      if (this.isFiscalIdentityUniqueError(error)) {
        throw new ConflictException("fiscal identity already exists for tenant");
      }
      throw error;
    }
  }

  async updateCustomer(
    id: string,
    tenantId: string,
    dto: UpdateElectronicInvoicingCustomerDto
  ) {
    const current = await this.customersRepository.findById(id, tenantId);
    if (!current) {
      throw new NotFoundException("customer not found");
    }

    const update: UpdateElectronicInvoicingCustomerInput = {};
    let nextDocumentTypeCode =
      current.dianIdentificationType ?? current.documentTypeCode;
    let nextIdentificationNumber =
      current.identificationNumber ?? current.documentNumberNormalized;

    if (hasOwn(dto, "name")) {
      const nextName = this.normalizeText(dto.name);
      if (!nextName && !(dto.isFinalConsumer ?? current.isFinalConsumer)) {
        throw new BadRequestException("name is required");
      }
      update.name = nextName ?? DEFAULT_FINAL_CONSUMER_NAME;
    }

    if (
      hasOwn(dto, "documentTypeCode") ||
      hasOwn(dto, "dianIdentificationType")
    ) {
      const documentTypeCode = this.resolveTextAliases(
        hasOwn(dto, "documentTypeCode") ? dto.documentTypeCode : undefined,
        hasOwn(dto, "dianIdentificationType")
          ? dto.dianIdentificationType
          : undefined,
        "documentTypeCode",
        "dianIdentificationType"
      );
      update.documentTypeCode = documentTypeCode;
      update.dianIdentificationType = documentTypeCode;
      nextDocumentTypeCode = documentTypeCode;
    }

    if (hasOwn(dto, "documentNumber") || hasOwn(dto, "identificationNumber")) {
      const identificationNumber = this.resolveDocumentNumberAliases(
        hasOwn(dto, "documentNumber") ? dto.documentNumber : undefined,
        hasOwn(dto, "identificationNumber") ? dto.identificationNumber : undefined
      );
      update.documentNumber =
        (hasOwn(dto, "documentNumber")
          ? this.normalizeText(dto.documentNumber)
          : identificationNumber) ?? null;
      update.documentNumberNormalized = identificationNumber;
      update.identificationNumber = identificationNumber;
      nextIdentificationNumber = identificationNumber;
    }

    if (
      hasOwn(dto, "documentTypeCode") ||
      hasOwn(dto, "dianIdentificationType") ||
      hasOwn(dto, "documentNumber") ||
      hasOwn(dto, "identificationNumber")
    ) {
      await this.ensureNoDuplicateIdentity(
        tenantId,
        nextDocumentTypeCode,
        nextIdentificationNumber,
        id
      );
    }

    if (hasOwn(dto, "verificationDigit")) {
      update.verificationDigit = this.normalizeText(dto.verificationDigit);
    }
    if (hasOwn(dto, "legalName")) {
      update.legalName = this.normalizeText(dto.legalName);
    }
    if (hasOwn(dto, "tradeName")) {
      update.tradeName = this.normalizeText(dto.tradeName);
    }
    if (hasOwn(dto, "fiscalEmail") || hasOwn(dto, "invoiceEmail")) {
      const invoiceEmail = this.resolveEmailAliases(
        hasOwn(dto, "fiscalEmail") ? dto.fiscalEmail : undefined,
        hasOwn(dto, "invoiceEmail") ? dto.invoiceEmail : undefined
      );
      update.fiscalEmail = invoiceEmail;
      update.invoiceEmail = invoiceEmail;
    }
    if (hasOwn(dto, "phone")) {
      update.phone = this.normalizeText(dto.phone);
    }
    if (hasOwn(dto, "address")) {
      update.address = this.normalizeText(dto.address);
    }
    if (hasOwn(dto, "countryCode")) {
      update.countryCode = this.normalizeText(dto.countryCode);
    }
    if (hasOwn(dto, "departmentCode")) {
      update.departmentCode = this.normalizeText(dto.departmentCode);
    }
    if (hasOwn(dto, "municipalityCode")) {
      update.municipalityCode = this.normalizeText(dto.municipalityCode);
    }
    if (hasOwn(dto, "personType")) {
      update.personType = this.normalizePersonType(dto.personType) ?? null;
    }
    if (hasOwn(dto, "taxRegime")) {
      update.taxRegime = this.normalizeText(dto.taxRegime);
    }
    if (hasOwn(dto, "taxResponsibilities")) {
      update.taxResponsibilities =
        this.normalizeTaxResponsibilities(dto.taxResponsibilities) ?? [];
    }
    if (hasOwn(dto, "fiscalStatus")) {
      update.fiscalStatus =
        this.normalizeFiscalStatus(dto.fiscalStatus) ?? "PENDING";
    }
    if (hasOwn(dto, "isDianValidated")) {
      update.isDianValidated = dto.isDianValidated ?? false;
    }
    if (hasOwn(dto, "dianLastLookupAt")) {
      update.dianLastLookupAt =
        this.normalizeTimestamp(dto.dianLastLookupAt) ?? null;
    }
    if (hasOwn(dto, "dianLastLookupStatus")) {
      update.dianLastLookupStatus =
        this.normalizeLookupStatus(dto.dianLastLookupStatus) ?? null;
    }
    if (hasOwn(dto, "dianMetadata")) {
      update.dianMetadata = this.normalizeDianMetadata(dto.dianMetadata) ?? {};
    }
    if (hasOwn(dto, "fiscalDataSource")) {
      update.fiscalDataSource =
        this.normalizeFiscalDataSource(dto.fiscalDataSource) ?? "MANUAL";
    }
    if (hasOwn(dto, "isActive")) {
      if (current.isFinalConsumer && dto.isActive === false) {
        throw new BadRequestException("final consumer cannot be deleted");
      }
      update.isActive = dto.isActive ?? true;
    }
    if (hasOwn(dto, "isFinalConsumer")) {
      if (current.isFinalConsumer && dto.isFinalConsumer === false) {
        throw new BadRequestException("final consumer cannot be unset");
      }
      update.isFinalConsumer = dto.isFinalConsumer ?? false;
      if (update.isFinalConsumer && (update.isActive ?? current.isActive)) {
        await this.ensureNoOtherFinalConsumer(tenantId, id);
      }
      if (update.isFinalConsumer && !hasOwn(update, "fiscalStatus")) {
        update.fiscalStatus = "NOT_REQUIRED";
      }
    }

    try {
      const updated = await this.customersRepository.update(id, tenantId, update);
      if (!updated) {
        throw new NotFoundException("customer not found");
      }
      return updated;
    } catch (error) {
      if (this.isFinalConsumerUniqueError(error)) {
        throw new ConflictException("final consumer already exists for tenant");
      }
      if (this.isFiscalIdentityUniqueError(error)) {
        throw new ConflictException("fiscal identity already exists for tenant");
      }
      throw error;
    }
  }

  async getDefaultFinalConsumer(tenantId: string) {
    const customer = await this.customersRepository.findActiveFinalConsumer(tenantId);
    if (!customer) {
      throw new NotFoundException("final consumer not found");
    }
    return customer;
  }

  async ensureDefaultFinalConsumer(tenantId: string) {
    const current = await this.customersRepository.findActiveFinalConsumer(tenantId);
    if (current) {
      return current;
    }

    try {
      return await this.createCustomer(tenantId, {
        name: DEFAULT_FINAL_CONSUMER_NAME,
        isFinalConsumer: true,
        fiscalStatus: "NOT_REQUIRED",
        fiscalDataSource: "MANUAL",
        isDianValidated: false,
        isActive: true,
      });
    } catch (error) {
      if (
        error instanceof ConflictException ||
        this.isFinalConsumerUniqueError(error)
      ) {
        const existing = await this.customersRepository.findActiveFinalConsumer(
          tenantId
        );
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }
}
