import { Inject, Injectable } from "@nestjs/common";
import { DatabaseService } from "../../common/db/database.service";
import { ControlCenterDatabaseService } from "./control-center-database.service";

type ControlCenterDatabaseChecks = {
  db_user: string;
  schema_present: boolean;
  audit_table_present: boolean;
  can_insert_audit: boolean | null;
  can_update_audit: boolean | null;
  can_delete_audit: boolean | null;
  platform_tenant_present: boolean;
  platform_tax_configured: boolean;
};

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

/**
 * Las funciones de privilegios fallan si el objeto no existe; por eso se
 * consultan solo cuando to_regclass/to_regnamespace confirman su existencia.
 */
const CONTROL_CENTER_CHECKS_SQL = `
  WITH objects AS (
    SELECT
      to_regnamespace('control_center') IS NOT NULL AS schema_present,
      to_regclass('control_center.admin_audit_events') IS NOT NULL AS audit_table_present
  )
  SELECT
    current_user AS db_user,
    objects.schema_present,
    objects.audit_table_present,
    (SELECT has_table_privilege('control_center.admin_audit_events', 'INSERT')
       WHERE objects.audit_table_present) AS can_insert_audit,
    (SELECT has_table_privilege('control_center.admin_audit_events', 'UPDATE')
       WHERE objects.audit_table_present) AS can_update_audit,
    (SELECT has_table_privilege('control_center.admin_audit_events', 'DELETE')
       WHERE objects.audit_table_present) AS can_delete_audit,
    EXISTS (SELECT 1 FROM public.tenants WHERE id = $1::uuid AND activo = TRUE) AS platform_tenant_present,
    EXISTS (
      SELECT 1 FROM public.taxes
      WHERE tenant_id = $1::uuid AND is_active = TRUE
    ) AS platform_tax_configured
  FROM objects
`;

const OPERATIONAL_ISOLATION_SQL = `
  SELECT COALESCE(
    (SELECT has_schema_privilege(current_user, 'control_center', 'USAGE')
       WHERE to_regnamespace('control_center') IS NOT NULL),
    FALSE
  ) AS has_access
`;

@Injectable()
export class ControlCenterReadinessService {
  constructor(
    @Inject(ControlCenterDatabaseService)
    private readonly controlCenterDb: ControlCenterDatabaseService,
    @Inject(DatabaseService)
    private readonly operationalDb: DatabaseService,
  ) {}

  async getReadiness(): Promise<ControlCenterReadiness> {
    const platformTenantId = this.controlCenterDb.getConfig().platformTenantId;
    const [checksResult, isolationResult] = await Promise.all([
      this.controlCenterDb.query<ControlCenterDatabaseChecks>(CONTROL_CENTER_CHECKS_SQL, [
        platformTenantId,
      ]),
      this.operationalDb.query<{ has_access: boolean }>(OPERATIONAL_ISOLATION_SQL),
    ]);
    return buildReadiness(platformTenantId, checksResult.rows[0], isolationResult.rows[0]?.has_access === true);
  }
}

export const buildReadiness = (
  platformTenantId: string,
  checks: ControlCenterDatabaseChecks,
  operationalRoleHasSchemaAccess: boolean,
  now: Date = new Date(),
): ControlCenterReadiness => {
  const auditImmutable = checks.can_update_audit === false && checks.can_delete_audit === false;
  const issues: string[] = [];
  if (!checks.schema_present) issues.push("SCHEMA_MISSING");
  if (!checks.audit_table_present) issues.push("AUDIT_TABLE_MISSING");
  if (checks.audit_table_present && checks.can_insert_audit !== true) issues.push("AUDIT_INSERT_DENIED");
  if (checks.audit_table_present && !auditImmutable) issues.push("AUDIT_NOT_IMMUTABLE");
  if (!checks.platform_tenant_present) issues.push("PLATFORM_TENANT_MISSING");
  if (operationalRoleHasSchemaAccess) issues.push("OPERATIONAL_ROLE_HAS_SCHEMA_ACCESS");

  return {
    status: issues.length === 0 ? "READY" : "DEGRADED",
    checkedAt: now.toISOString(),
    platformTenantId,
    database: {
      user: checks.db_user,
      schemaPresent: checks.schema_present,
      auditTablePresent: checks.audit_table_present,
      canInsertAudit: checks.can_insert_audit === true,
      auditImmutable,
      platformTenantPresent: checks.platform_tenant_present,
      platformTaxConfigured: checks.platform_tax_configured,
    },
    isolation: { operationalRoleHasSchemaAccess },
    issues,
  };
};
