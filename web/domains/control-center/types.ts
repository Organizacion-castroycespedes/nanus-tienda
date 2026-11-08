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
