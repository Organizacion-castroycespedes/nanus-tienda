export type ControlCenterReadiness = {
  status: "READY" | "DEGRADED";
  checkedAt: string;
  platformTenantId: string;
  database: {
    user: string;
    schemaPresent: boolean;
    auditTablePresent: boolean;
    canInsertAudit: boolean;
    auditImmutable: boolean;
    platformTenantPresent: boolean;
    platformTaxConfigured: boolean;
  };
  isolation: {
    operationalRoleHasSchemaAccess: boolean;
  };
  issues: string[];
};

export type Paged<T> = { items: T[]; total: number; limit: number; offset: number };

export type TenantDirectoryEntry = {
  id: string;
  slug: string;
  name: string | null;
  active: boolean;
  createdAt: string;
  legalName: string | null;
  taxId: string | null;
  dv: string | null;
  activeBranches: number;
  activePosTerminals: number;
  link: { accountId: string; accountLegalName: string } | null;
  contract: { id: string; number: string; status: ContractStatus; contractedPosTerminals: number } | null;
  terminalStatus: "OK" | "EXCEEDED" | "NO_CONTRACT";
};

export type TaxIdType = "NIT" | "CC" | "CE" | "PASAPORTE";

export type CommercialAccount = {
  id: string;
  legalName: string;
  taxIdType: TaxIdType;
  taxId: string;
  dv: string | null;
  billingEmail: string;
  contactName: string | null;
  contactPhoneE164: string | null;
  whatsappOptIn: boolean;
  whatsappOptInAt: string | null;
  address: string | null;
  city: string | null;
  status: "ACTIVE" | "INACTIVE";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  activeTenants?: number;
};

export type AccountTenantLink = {
  id: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string | null;
  status: "ACTIVE" | "ENDED";
  linkedAt: string;
  endedAt: string | null;
  endReason: string | null;
};

export type AccountDetail = CommercialAccount & { tenants: AccountTenantLink[] };

export type BillingFrequency = "MONTHLY" | "ANNUAL";
export type ItemFrequency = BillingFrequency | "ONE_TIME";
export type PriceComponentCode = "BASE_INITIAL_TERM" | "BASE_RENEWAL" | "EXTRA_POS_TERMINAL" | "CERTIFICATION";

export type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "RETIRED";
  createdAt: string;
  currentVersionId: string | null;
  currentVersionNo: number | null;
  currentValidFrom: string | null;
};

export type PlatformTax = { id: string; name: string; rate: string; isIncluded: boolean };

export type PriceComponent = { component: PriceComponentCode; billingFrequency: BillingFrequency; amount: string };

export type PriceVersion = {
  id: string;
  versionNo: number;
  validFrom: string;
  validTo: string | null;
  currency: string;
  taxId: string;
  taxName: string | null;
  taxRate: string | null;
  pricesIncludeTax: boolean;
  includedPosTerminals: number;
  initialTermMonths: number;
  defaultTrialMonths: number;
  reason: string;
  createdAt: string;
  components: PriceComponent[];
};

export type ContractStatus = "DRAFT" | "ACTIVE" | "ENDED" | "CANCELLED";
export type TermPhase = "INITIAL" | "RENEWAL";

export type ContractListItem = {
  id: string;
  contractNumber: string;
  status: ContractStatus;
  startDate: string;
  endDate: string | null;
  accountId: string;
  accountLegalName: string;
  tenantId: string;
  tenantName: string | null;
  tenantSlug: string;
  planCode: string;
  planName: string;
  termPhase: TermPhase | null;
  billingFrequency: BillingFrequency | null;
  createdAt: string;
};

export type ContractItem = {
  id?: string;
  itemType: "BASE" | "EXTRA_POS_TERMINAL" | "CERTIFICATION" | "CUSTOM";
  description: string;
  quantity: string;
  unitAmount: string;
  billingFrequency: ItemFrequency;
  discountAmount: string;
  metadata: Record<string, unknown>;
};

export type FrequencyTotals = { subtotal: string; base: string; tax: string; total: string };
export type TotalsByFrequency = Partial<Record<ItemFrequency, FrequencyTotals>>;

export type ContractVersion = {
  id: string;
  versionNo: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  termPhase: TermPhase;
  billingFrequency: BillingFrequency;
  billingAnchorDay: number;
  trialEndsOn: string | null;
  prorationPolicy: "NONE" | "DAILY";
  taxName: string;
  taxRate: string;
  pricesIncludeTax: boolean;
  includedPosTerminals: number;
  reason: string | null;
  createdAt: string;
  items: ContractItem[];
  contractedPosTerminals: number;
  totals: TotalsByFrequency;
};

export type ContractDetail = {
  id: string;
  contractNumber: string;
  status: ContractStatus;
  startDate: string;
  endDate: string | null;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  account: { id: string; legalName: string; taxIdType: TaxIdType; taxId: string; billingEmail: string };
  tenant: { id: string; slug: string; name: string | null };
  plan: { id: string; code: string; name: string; status: string };
  activePosTerminals: number;
  versions: ContractVersion[];
  audit: Array<{ id: string; occurredAt: string; action: string; actorUserId: string; reason: string | null }>;
};

export type ContractPreview = {
  priceVersionId: string;
  priceVersionNo: number;
  tax: { name: string; rate: string; pricesIncludeTax: boolean };
  billingAnchorDay: number;
  trialEndsOn: string | null;
  contractedPosTerminals: number;
  priceAdjusted: boolean;
  items: ContractItem[];
  totals: TotalsByFrequency;
};

export type CustomItemInput = {
  description: string;
  quantity: string;
  unitAmount: string;
  billingFrequency: ItemFrequency;
  discountAmount: string;
};

export type ContractDraftInput = {
  accountId: string;
  tenantId: string;
  planId: string;
  startDate: string;
  billingFrequency: BillingFrequency;
  extraPosTerminals: number;
  prorationPolicy?: "NONE" | "DAILY";
  trialMonths?: number | null;
  customItems?: CustomItemInput[];
  reason?: string;
};
