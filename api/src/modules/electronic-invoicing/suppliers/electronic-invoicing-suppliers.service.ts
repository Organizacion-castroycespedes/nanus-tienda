import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import crypto from "crypto";
import type { CreateElectronicInvoicingSupplierDto } from "./dto/create-electronic-invoicing-supplier.dto";
import type { ListElectronicInvoicingSuppliersDto } from "./dto/list-electronic-invoicing-suppliers.dto";
import type { UpdateElectronicInvoicingSupplierDto } from "./dto/update-electronic-invoicing-supplier.dto";
import type {
  ApplyThirdPartyLookupDto,
  ThirdPartyLookupDto,
} from "../third-party-lookup/dto/third-party-lookup.dto";
import { ThirdPartyLookupService } from "../third-party-lookup/third-party-lookup.service";
import type {
  ThirdPartyLookupData,
  ThirdPartyLookupField,
  ThirdPartyLookupStatus,
} from "../third-party-lookup/third-party-lookup.types";
import type {
  CreateElectronicInvoicingSupplierInput,
  ListElectronicInvoicingSuppliersFilters,
  SupplierFiscalDataSource,
  SupplierFiscalLastLookupStatus,
  SupplierFiscalStatus,
  SupplierPersonType,
  UpdateElectronicInvoicingSupplierInput,
} from "./electronic-invoicing-supplier.types";
import { ElectronicInvoicingSuppliersRepository } from "./electronic-invoicing-suppliers.repository";

type PgErrorLike = {
  code?: string;
  constraint?: string;
};

const VALID_FISCAL_STATUSES = new Set<SupplierFiscalStatus>([
  "PENDING",
  "VALIDATED",
  "FAILED",
  "NOT_REQUIRED",
]);

const VALID_LOOKUP_STATUSES = new Set<SupplierFiscalLastLookupStatus>([
  "PENDING",
  "FOUND",
  "NOT_FOUND",
  "ERROR",
  "SKIPPED",
]);

const VALID_FISCAL_DATA_SOURCES = new Set<SupplierFiscalDataSource>([
  "MANUAL",
  "MOCK_LOCAL",
  "DIAN_DIRECT",
  "TECH_PROVIDER",
  "RUT",
  "UNKNOWN",
]);

const VALID_PERSON_TYPES = new Set<SupplierPersonType>([
  "NATURAL",
  "JURIDICA",
  "UNKNOWN",
]);

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hasOwn = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

export const normalizeSupplierFiscalDocument = (
  value?: string | null
): string | null => {
  const normalized = value?.trim().toUpperCase().replace(/[^0-9A-Z]/g, "") ?? "";
  return normalized.length > 0 ? normalized : null;
};

@Injectable()
export class ElectronicInvoicingSuppliersService {
  constructor(
    @Inject(ElectronicInvoicingSuppliersRepository)
    private readonly suppliersRepository: ElectronicInvoicingSuppliersRepository,
    @Optional()
    @Inject(ThirdPartyLookupService)
    private readonly thirdPartyLookupService?: ThirdPartyLookupService
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

  private normalizeFiscalStatus(
    value?: SupplierFiscalStatus | null
  ): SupplierFiscalStatus | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (!VALID_FISCAL_STATUSES.has(value)) {
      throw new BadRequestException("fiscalStatus is invalid");
    }
    return value;
  }

  private normalizeLookupStatus(
    value?: SupplierFiscalLastLookupStatus | null
  ): SupplierFiscalLastLookupStatus | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    if (!VALID_LOOKUP_STATUSES.has(value)) {
      throw new BadRequestException("fiscalLastLookupStatus is invalid");
    }
    return value;
  }

  private normalizeFiscalDataSource(
    value?: SupplierFiscalDataSource | null
  ): SupplierFiscalDataSource | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (!VALID_FISCAL_DATA_SOURCES.has(value)) {
      throw new BadRequestException("fiscalDataSource is invalid");
    }
    if (value === "DIAN_DIRECT") {
      throw new BadRequestException("DIAN_DIRECT is not supported for suppliers");
    }
    return value;
  }

  private normalizePersonType(
    value?: SupplierPersonType | null
  ): SupplierPersonType | null | undefined {
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
      throw new BadRequestException("fiscalLastLookupAt is invalid");
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
    const normalizedDocumentNumber =
      normalizeSupplierFiscalDocument(documentNumber);
    const normalizedIdentificationNumber =
      normalizeSupplierFiscalDocument(identificationNumber);
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

  private normalizeSupplierProvider(value?: string | null): string | null {
    const provider = this.normalizeText(value);
    if (provider === "DIAN_DIRECT") {
      throw new BadRequestException("DIAN_DIRECT is not supported for suppliers");
    }
    return provider;
  }

  private buildFilters(
    query: ListElectronicInvoicingSuppliersDto
  ): ListElectronicInvoicingSuppliersFilters {
    return {
      search: this.normalizeText(query.search) ?? undefined,
      documentTypeCode: this.normalizeText(query.documentTypeCode) ?? undefined,
      documentNumber:
        normalizeSupplierFiscalDocument(query.documentNumber) ??
        this.normalizeText(query.documentNumber) ??
        undefined,
      isDianValidated: this.parseBoolean(
        query.isDianValidated,
        "isDianValidated"
      ),
      fiscalDataSource: this.normalizeFiscalDataSource(query.fiscalDataSource),
      fiscalStatus: this.normalizeFiscalStatus(query.fiscalStatus),
      isActive: this.parseBoolean(query.isActive, "isActive"),
    };
  }

  private async ensureNoDuplicateIdentity(
    tenantId: string,
    documentTypeCode: string | null,
    identificationNumber: string | null,
    excludeSupplierId?: string
  ) {
    if (!identificationNumber) {
      return;
    }

    const duplicate = documentTypeCode
      ? await this.suppliersRepository.findByFiscalIdentity(
          tenantId,
          documentTypeCode,
          identificationNumber,
          excludeSupplierId
        )
      : await this.suppliersRepository.findByNormalizedDocument(
          tenantId,
          identificationNumber,
          excludeSupplierId
        );

    if (duplicate) {
      throw new ConflictException("fiscal identity already exists for tenant");
    }
  }

  private isFiscalIdentityUniqueError(error: unknown) {
    const pgError = error as PgErrorLike;
    return (
      pgError?.code === "23505" &&
      pgError.constraint === "ux_suppliers_tenant_fiscal_identity_fe_3_2"
    );
  }

  private getLookupService() {
    if (!this.thirdPartyLookupService) {
      throw new BadRequestException("third party lookup service is not configured");
    }
    return this.thirdPartyLookupService;
  }

  private resolveFiscalStatusFromLookup(
    lookupStatus: ThirdPartyLookupStatus,
    appliedFieldsCount: number
  ): SupplierFiscalStatus | undefined {
    if (lookupStatus === "FOUND" && appliedFieldsCount > 0) {
      return "VALIDATED";
    }
    if (lookupStatus === "NOT_FOUND" || lookupStatus === "ERROR") {
      return "FAILED";
    }
    return undefined;
  }

  private applyLookupField(
    update: UpdateElectronicInvoicingSupplierDto,
    data: ThirdPartyLookupData,
    field: ThirdPartyLookupField
  ) {
    if (field === "documentTypeCode") {
      update.documentTypeCode = data.documentTypeCode;
      update.dianIdentificationType = data.dianIdentificationType;
      return;
    }
    if (field === "documentNumber") {
      update.documentNumber = data.documentNumber;
      update.identificationNumber = data.identificationNumber;
      return;
    }
    if (field === "fiscalEmail") {
      update.fiscalEmail = data.fiscalEmail;
      update.invoiceEmail = data.invoiceEmail;
      return;
    }

    update[field] = data[field] as never;
  }

  listSuppliers(
    tenantId: string,
    query: ListElectronicInvoicingSuppliersDto
  ) {
    return this.suppliersRepository.listByTenant(
      tenantId,
      this.buildFilters(query)
    );
  }

  async getSupplier(id: string, tenantId: string) {
    const supplier = await this.suppliersRepository.findById(id, tenantId);
    if (!supplier) {
      throw new NotFoundException("supplier not found");
    }
    return supplier;
  }

  lookupSupplierFiscalData(tenantId: string, dto: ThirdPartyLookupDto) {
    return this.getLookupService().lookup({
      tenantId,
      partyType: "SUPPLIER",
      ...dto,
    });
  }

  async applySupplierLookup(
    id: string,
    tenantId: string,
    dto: ApplyThirdPartyLookupDto
  ) {
    const current = await this.getSupplier(id, tenantId);
    const lookupService = this.getLookupService();
    const fieldsToApply = lookupService.resolveFieldsToApply(dto);
    const preview = await lookupService.lookup({
      tenantId,
      partyType: "SUPPLIER",
      ...dto,
    });
    const fieldDiffs = lookupService.buildFieldDiffs(
      current,
      preview.data,
      fieldsToApply
    );
    const fiscalStatus = this.resolveFiscalStatusFromLookup(
      preview.lookupStatus,
      fieldsToApply.length
    );
    const update: UpdateElectronicInvoicingSupplierDto = {
      fiscalLastLookupAt: preview.lookupAt,
      fiscalLastLookupStatus: preview.lookupStatus,
      fiscalProvider: preview.provider === "MOCK_LOCAL" ? "MOCK_LOCAL" : "NONE",
      fiscalDataSource:
        preview.provider === "MOCK_LOCAL" ? "MOCK_LOCAL" : "UNKNOWN",
      dianMetadata: lookupService.mergeLookupMetadata(
        current.dianMetadata,
        preview
      ),
    };

    if (fiscalStatus) {
      update.fiscalStatus = fiscalStatus;
      update.isDianValidated = fiscalStatus === "VALIDATED";
    }

    if (preview.lookupStatus === "FOUND" && preview.data) {
      for (const field of fieldsToApply) {
        this.applyLookupField(update, preview.data, field);
      }
    }

    const supplier = await this.updateSupplier(id, tenantId, update);

    return {
      supplier,
      preview: {
        ...preview,
        fieldDiffs,
      },
      appliedFields: fieldsToApply,
    };
  }

  async createSupplier(
    tenantId: string,
    dto: CreateElectronicInvoicingSupplierDto
  ) {
    const name = this.normalizeText(dto.name);
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
    const fiscalStatus = this.normalizeFiscalStatus(dto.fiscalStatus) ?? "PENDING";
    const fiscalProvider = this.normalizeSupplierProvider(dto.fiscalProvider);

    await this.ensureNoDuplicateIdentity(
      tenantId,
      documentTypeCode,
      identificationNumber
    );

    const input: CreateElectronicInvoicingSupplierInput = {
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
      fiscalStatus,
      fiscalProvider,
      fiscalDataSource:
        this.normalizeFiscalDataSource(dto.fiscalDataSource) ?? "MANUAL",
      isDianValidated: dto.isDianValidated ?? fiscalStatus === "VALIDATED",
      fiscalLastLookupAt: this.normalizeTimestamp(dto.fiscalLastLookupAt) ?? null,
      fiscalLastLookupStatus: this.normalizeLookupStatus(
        dto.fiscalLastLookupStatus
      ) ?? null,
      dianMetadata: this.normalizeDianMetadata(dto.dianMetadata) ?? {},
      isActive: dto.isActive ?? true,
    };

    try {
      return await this.suppliersRepository.create(input);
    } catch (error) {
      if (this.isFiscalIdentityUniqueError(error)) {
        throw new ConflictException("fiscal identity already exists for tenant");
      }
      throw error;
    }
  }

  async updateSupplier(
    id: string,
    tenantId: string,
    dto: UpdateElectronicInvoicingSupplierDto
  ) {
    const current = await this.suppliersRepository.findById(id, tenantId);
    if (!current) {
      throw new NotFoundException("supplier not found");
    }

    const update: UpdateElectronicInvoicingSupplierInput = {};
    let nextDocumentTypeCode =
      current.dianIdentificationType ?? current.documentTypeCode;
    let nextIdentificationNumber =
      current.identificationNumber ?? current.documentNumberNormalized;

    if (hasOwn(dto, "name")) {
      const nextName = this.normalizeText(dto.name);
      if (!nextName) {
        throw new BadRequestException("name is required");
      }
      update.name = nextName;
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
    if (hasOwn(dto, "fiscalProvider")) {
      update.fiscalProvider = this.normalizeSupplierProvider(dto.fiscalProvider);
    }
    if (hasOwn(dto, "fiscalDataSource")) {
      update.fiscalDataSource =
        this.normalizeFiscalDataSource(dto.fiscalDataSource) ?? "MANUAL";
    }
    if (hasOwn(dto, "isDianValidated")) {
      update.isDianValidated = dto.isDianValidated ?? false;
    }
    if (hasOwn(dto, "fiscalLastLookupAt")) {
      update.fiscalLastLookupAt =
        this.normalizeTimestamp(dto.fiscalLastLookupAt) ?? null;
    }
    if (hasOwn(dto, "fiscalLastLookupStatus")) {
      update.fiscalLastLookupStatus = this.normalizeLookupStatus(
        dto.fiscalLastLookupStatus
      );
    }
    if (hasOwn(dto, "dianMetadata")) {
      update.dianMetadata = this.normalizeDianMetadata(dto.dianMetadata) ?? {};
    }
    if (hasOwn(dto, "isActive")) {
      update.isActive = dto.isActive ?? true;
    }

    try {
      const updated = await this.suppliersRepository.update(id, tenantId, update);
      if (!updated) {
        throw new NotFoundException("supplier not found");
      }
      return updated;
    } catch (error) {
      if (this.isFiscalIdentityUniqueError(error)) {
        throw new ConflictException("fiscal identity already exists for tenant");
      }
      throw error;
    }
  }
}
