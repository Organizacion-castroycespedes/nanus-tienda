import { Injectable } from "@nestjs/common";
import {
  DEFAULT_FINAL_CONSUMER_NAME,
  PLATFORM_ONLY_MENU_SCOPES,
  TENANT_BOOTSTRAP_AUDIT,
  TENANT_BOOTSTRAP_VERSION,
} from "./tenant-bootstrap.policy";

/** Cliente transaccional mínimo (pg.PoolClient lo cumple). */
export type BootstrapSqlClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
};

export type TenantBootstrapErrorCode =
  | "TENANT_BOOTSTRAP_INVALID_INPUT"
  | "TENANT_BOOTSTRAP_SOURCE_MISSING"
  | "TENANT_BOOTSTRAP_SOURCE_INACTIVE"
  | "TENANT_BOOTSTRAP_SOURCE_INCOMPLETE"
  | "TENANT_BOOTSTRAP_TARGET_MISSING"
  | "TENANT_BOOTSTRAP_TARGET_NOT_EMPTY"
  | "TENANT_BOOTSTRAP_INTEGRITY_FAILED";

export class TenantBootstrapError extends Error {
  constructor(
    readonly code: TenantBootstrapErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "TenantBootstrapError";
  }
}

export type TenantBootstrapCounts = {
  menuItems: number;
  roleMenuPermissions: number;
  customers: number;
  units: number;
  taxes: number;
  taxRates: number;
  paymentMethods: number;
  paymentMethodFinancialInstitutions: number;
};

export type TenantBootstrapManualItem = {
  table: string;
  reason: string;
  items: string[];
};

export type TenantBootstrapSummary = {
  status: "COMPLETED" | "ALREADY_COMPLETED";
  version: string;
  sourceTenantId: string;
  targetTenantId: string;
  counts: TenantBootstrapCounts;
  manual: TenantBootstrapManualItem[];
};

export type TenantBootstrapInput = {
  targetTenantId: string;
  sourceTenantId: string;
  actorUserId?: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toCount = (value: unknown) => Number(value ?? 0);

const MANAGED_TABLES = [
  "menu_items",
  "role_menu_permissions",
  "customers",
  "units",
  "taxes",
  "tax_rates",
  "payment_methods",
  "payment_method_financial_institutions",
] as const;

/*
 * Todas las sentencias reciben $1 = tenant destino y $2 = tenant origen.
 * Nunca se interpolan valores: los identificadores de tabla salen de la
 * constante MANAGED_TABLES.
 */

// Ítems del origen que se copian: no eliminados, sin scope exclusivo de la
// plataforma ni descendientes de uno, y con padre válido del mismo tenant.
const COPYABLE_MENU_CTE = `
  WITH RECURSIVE excluded AS (
    SELECT m.id
    FROM menu_items m
    WHERE m.tenant_id = $2::uuid
      AND $1::uuid IS NOT NULL
      AND m.deleted_at IS NULL
      AND (m.metadata ->> 'scope') = ANY($3::text[])
    UNION
    SELECT child.id
    FROM menu_items child
    JOIN excluded e ON child.parent_id = e.id
    WHERE child.tenant_id = $2
      AND child.deleted_at IS NULL
  ),
  copyable AS (
    SELECT s.*
    FROM menu_items s
    WHERE s.tenant_id = $2
      AND s.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM excluded e WHERE e.id = s.id)
      AND (
        s.parent_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM menu_items p
          WHERE p.id = s.parent_id
            AND p.tenant_id = $2
            AND p.deleted_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM excluded e WHERE e.id = p.id)
        )
      )
  )`;

// Impuestos copiables: activos, clasificados y sin ambigüedad de tipo+nombre.
const COPYABLE_TAXES_PREDICATE = `
  t.tenant_id = $2
  AND t.is_active = TRUE
  AND t.tax_type_id IS NOT NULL
  AND t.calculation_method_id IS NOT NULL
  AND t.tax_base_type_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM taxes o
    WHERE o.tenant_id = $2
      AND o.is_active = TRUE
      AND o.id <> t.id
      AND o.tax_type_id = t.tax_type_id
      AND UPPER(BTRIM(o.name)) = UPPER(BTRIM(t.name))
  )`;

const COPYABLE_RATE_PREDICATE = `
  r.tenant_id = $2
  AND r.is_active = TRUE
  AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)`;

@Injectable()
export class TenantBootstrapService {
  /**
   * Aprovisiona el tenant destino copiando la configuración base vigente del
   * origen. Debe ejecutarse dentro de una transacción abierta por el llamador
   * (idealmente REPEATABLE READ) usando el mismo cliente: no abre conexiones.
   */
  async bootstrap(
    client: BootstrapSqlClient,
    input: TenantBootstrapInput,
  ): Promise<TenantBootstrapSummary> {
    const targetTenantId = input.targetTenantId?.trim();
    const sourceTenantId = input.sourceTenantId?.trim();
    if (!UUID_PATTERN.test(targetTenantId ?? "") || !UUID_PATTERN.test(sourceTenantId ?? "")) {
      throw new TenantBootstrapError(
        "TENANT_BOOTSTRAP_INVALID_INPUT",
        "Tenant origen o destino invalido",
      );
    }
    if (targetTenantId === sourceTenantId) {
      throw new TenantBootstrapError(
        "TENANT_BOOTSTRAP_INVALID_INPUT",
        "El tenant destino no puede ser el tenant origen",
      );
    }

    // Serializa aprovisionamientos concurrentes del mismo destino.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('tenant-bootstrap:' || $1::text, 0))",
      [targetTenantId],
    );

    await this.assertTenants(client, targetTenantId, sourceTenantId);

    const previous = await this.findCompletedMarker(client, targetTenantId);
    if (previous) {
      return { ...previous, status: "ALREADY_COMPLETED" };
    }
    await this.assertTargetEmpty(client, targetTenantId);

    const params = [targetTenantId, sourceTenantId];
    const expected = await this.readExpectedCounts(client, params);
    if (expected.menuItems === 0) {
      throw new TenantBootstrapError(
        "TENANT_BOOTSTRAP_SOURCE_INCOMPLETE",
        "El tenant origen no tiene menu configurado",
        { sourceTenantId },
      );
    }
    const manual = await this.readManualItems(client, params);

    const counts: TenantBootstrapCounts = {
      menuItems: await this.copyMenuItems(client, params),
      roleMenuPermissions: 0,
      customers: 0,
      units: 0,
      taxes: 0,
      taxRates: 0,
      paymentMethods: 0,
      paymentMethodFinancialInstitutions: 0,
    };
    await this.remapMenuParents(client, params);
    counts.roleMenuPermissions = await this.copyRoleMenuPermissions(client, params);
    counts.customers = await this.generateFinalConsumer(client, params);
    counts.units = await this.copyUnits(client, params);
    const taxes = await this.copyTaxesAndRates(client, params);
    counts.taxes = taxes.taxes;
    counts.taxRates = taxes.taxRates;
    counts.paymentMethods = await this.copyPaymentMethods(client, params);
    counts.paymentMethodFinancialInstitutions = await this.copyPaymentMethodInstitutions(client, params);

    await this.verify(client, params, expected, counts);

    const summary: TenantBootstrapSummary = {
      status: "COMPLETED",
      version: TENANT_BOOTSTRAP_VERSION,
      sourceTenantId,
      targetTenantId,
      counts,
      manual,
    };
    await this.recordAudit(client, summary, input.actorUserId ?? null);
    return summary;
  }

  private async assertTenants(client: BootstrapSqlClient, targetTenantId: string, sourceTenantId: string) {
    const result = await client.query(
      "SELECT id, activo FROM tenants WHERE id = ANY($1::uuid[])",
      [[targetTenantId, sourceTenantId]],
    );
    const rows = result.rows ?? [];
    const source = rows.find((row) => row.id === sourceTenantId);
    const target = rows.find((row) => row.id === targetTenantId);
    if (!source) {
      throw new TenantBootstrapError(
        "TENANT_BOOTSTRAP_SOURCE_MISSING",
        "El tenant origen no existe",
        { sourceTenantId },
      );
    }
    if (source.activo !== true) {
      throw new TenantBootstrapError(
        "TENANT_BOOTSTRAP_SOURCE_INACTIVE",
        "El tenant origen esta inactivo",
        { sourceTenantId },
      );
    }
    if (!target) {
      throw new TenantBootstrapError(
        "TENANT_BOOTSTRAP_TARGET_MISSING",
        "El tenant destino no existe",
        { targetTenantId },
      );
    }
  }

  private async findCompletedMarker(
    client: BootstrapSqlClient,
    targetTenantId: string,
  ): Promise<TenantBootstrapSummary | null> {
    const result = await client.query(
      `SELECT datos_despues
       FROM auditoria_eventos
       WHERE tenant_id = $1::uuid
         AND entidad = $2
         AND entidad_id = $1::uuid::text
         AND accion = $3
       ORDER BY id DESC
       LIMIT 1`,
      [targetTenantId, TENANT_BOOTSTRAP_AUDIT.entity, TENANT_BOOTSTRAP_AUDIT.completedAction],
    );
    const stored = result.rows?.[0]?.datos_despues;
    return stored && typeof stored === "object" ? (stored as TenantBootstrapSummary) : null;
  }

  private async assertTargetEmpty(client: BootstrapSqlClient, targetTenantId: string) {
    const selects = MANAGED_TABLES.map(
      (table) => `(SELECT COUNT(*) FROM ${table} WHERE tenant_id = $1) AS ${table}`,
    ).join(",\n");
    const result = await client.query(`SELECT ${selects}`, [targetTenantId]);
    const row = result.rows?.[0] ?? {};
    const populated = MANAGED_TABLES.filter((table) => toCount(row[table]) > 0);
    if (populated.length > 0) {
      throw new TenantBootstrapError(
        "TENANT_BOOTSTRAP_TARGET_NOT_EMPTY",
        "El tenant destino ya tiene configuracion parcial; requiere revision manual",
        { targetTenantId, populated },
      );
    }
  }

  private async readExpectedCounts(client: BootstrapSqlClient, params: string[]) {
    const result = await client.query(
      `${COPYABLE_MENU_CTE}
      SELECT
        (SELECT COUNT(*) FROM copyable) AS menu_items,
        (SELECT COUNT(*) FROM copyable WHERE parent_id IS NOT NULL) AS menu_children,
        (SELECT COUNT(*)
           FROM role_menu_permissions rmp
           JOIN copyable c ON c.id = rmp.menu_item_id
           JOIN roles r ON r.id = rmp.role_id
          WHERE rmp.tenant_id = $2) AS role_menu_permissions,
        (SELECT COUNT(*) FROM taxes t WHERE ${COPYABLE_TAXES_PREDICATE}) AS taxes,
        (SELECT COUNT(*)
           FROM tax_rates r
           JOIN taxes t ON t.id = r.tax_id AND t.tenant_id = r.tenant_id
          WHERE ${COPYABLE_TAXES_PREDICATE} AND ${COPYABLE_RATE_PREDICATE}) AS tax_rates`,
      [...params, [...PLATFORM_ONLY_MENU_SCOPES]],
    );
    const row = result.rows?.[0] ?? {};
    return {
      menuItems: toCount(row.menu_items),
      menuChildren: toCount(row.menu_children),
      roleMenuPermissions: toCount(row.role_menu_permissions),
      taxes: toCount(row.taxes),
      taxRates: toCount(row.tax_rates),
    };
  }

  private async readManualItems(
    client: BootstrapSqlClient,
    params: string[],
  ): Promise<TenantBootstrapManualItem[]> {
    const manual: TenantBootstrapManualItem[] = [];

    const ambiguousTaxes = await client.query(
      `SELECT t.name
       FROM taxes t
       WHERE t.tenant_id = $2::uuid
         AND $1::uuid IS NOT NULL
         AND t.is_active = TRUE
         AND (
           t.tax_type_id IS NULL
           OR t.calculation_method_id IS NULL
           OR t.tax_base_type_id IS NULL
           OR EXISTS (
             SELECT 1 FROM taxes o
             WHERE o.tenant_id = $2
               AND o.is_active = TRUE
               AND o.id <> t.id
               AND o.tax_type_id = t.tax_type_id
               AND UPPER(BTRIM(o.name)) = UPPER(BTRIM(t.name))
           )
         )
       ORDER BY t.name, t.id`,
      params,
    );
    const taxNames = (ambiguousTaxes.rows ?? []).map((row) => String(row.name));
    if (taxNames.length > 0) {
      manual.push({
        table: "taxes",
        reason: "Impuestos activos ambiguos (mismo tipo y nombre) o sin clasificacion fiscal en el origen",
        items: taxNames,
      });
    }

    const skippedMenu = await client.query(
      `${COPYABLE_MENU_CTE}
       SELECT s.key
       FROM menu_items s
       WHERE s.tenant_id = $2
         AND s.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM copyable c WHERE c.id = s.id)
         AND NOT EXISTS (SELECT 1 FROM excluded e WHERE e.id = s.id)
       ORDER BY s.key`,
      [...params, [...PLATFORM_ONLY_MENU_SCOPES]],
    );
    const orphanKeys = (skippedMenu.rows ?? []).map((row) => String(row.key));
    if (orphanKeys.length > 0) {
      manual.push({
        table: "menu_items",
        reason: "Items del origen con padre eliminado o de otro tenant",
        items: orphanKeys,
      });
    }

    return manual;
  }

  private async copyMenuItems(client: BootstrapSqlClient, params: string[]) {
    const result = await client.query(
      `${COPYABLE_MENU_CTE}
      INSERT INTO menu_items (
        id, tenant_id, key, module, label, route, icon, parent_id, sort_order,
        visible, below_main_menu, metadata, created_at, updated_at
      )
      SELECT
        gen_random_uuid(), $1, c.key, c.module, c.label, c.route, c.icon, NULL,
        c.sort_order, c.visible, c.below_main_menu, COALESCE(c.metadata, '{}'::jsonb),
        NOW(), NOW()
      FROM copyable c
      RETURNING id`,
      [...params, [...PLATFORM_ONLY_MENU_SCOPES]],
    );
    return result.rows?.length ?? 0;
  }

  private async remapMenuParents(client: BootstrapSqlClient, params: string[]) {
    await client.query(
      `UPDATE menu_items target
       SET parent_id = target_parent.id
       FROM menu_items source
       JOIN menu_items source_parent
         ON source_parent.id = source.parent_id
        AND source_parent.tenant_id = $2
        AND source_parent.deleted_at IS NULL
       JOIN menu_items target_parent
         ON target_parent.tenant_id = $1
        AND target_parent.key = source_parent.key
        AND target_parent.deleted_at IS NULL
       WHERE source.tenant_id = $2
         AND source.deleted_at IS NULL
         AND target.tenant_id = $1
         AND target.deleted_at IS NULL
         AND target.key = source.key`,
      params,
    );
  }

  private async copyRoleMenuPermissions(client: BootstrapSqlClient, params: string[]) {
    const result = await client.query(
      `INSERT INTO role_menu_permissions (tenant_id, role_id, menu_item_id, access_level, actions)
       SELECT $1, rmp.role_id, target_item.id, rmp.access_level, COALESCE(rmp.actions, '{}'::jsonb)
       FROM role_menu_permissions rmp
       JOIN menu_items source_item
         ON source_item.id = rmp.menu_item_id
        AND source_item.tenant_id = $2
        AND source_item.deleted_at IS NULL
       JOIN menu_items target_item
         ON target_item.tenant_id = $1
        AND target_item.key = source_item.key
        AND target_item.deleted_at IS NULL
       JOIN roles r ON r.id = rmp.role_id
       WHERE rmp.tenant_id = $2
       RETURNING id`,
      params,
    );
    return result.rows?.length ?? 0;
  }

  /**
   * Genera el consumidor final usando como plantilla la identidad del
   * consumidor final del origen, sin datos de contacto ni ubicación.
   */
  private async generateFinalConsumer(client: BootstrapSqlClient, params: string[]) {
    const result = await client.query(
      `INSERT INTO customers (
        id, tenant_id, name, trade_name, legal_name, document_number,
        document_type_code, document_number_normalized, verification_digit,
        dian_identification_type, identification_number, person_type, tax_regime,
        tax_responsibilities, is_final_consumer, is_default, is_active,
        fiscal_status, fiscal_data_source, is_dian_validated, dian_metadata,
        created_at, updated_at
      )
      SELECT
        gen_random_uuid(),
        $1,
        COALESCE(NULLIF(BTRIM(src.name), ''), $3),
        COALESCE(NULLIF(BTRIM(src.trade_name), ''), NULLIF(BTRIM(src.name), ''), $3),
        NULLIF(BTRIM(src.legal_name), ''),
        NULLIF(BTRIM(src.document_number), ''),
        NULLIF(BTRIM(src.document_type_code), ''),
        NULLIF(BTRIM(src.document_number_normalized), ''),
        NULLIF(BTRIM(src.verification_digit), ''),
        NULLIF(BTRIM(src.dian_identification_type), ''),
        NULLIF(BTRIM(src.identification_number), ''),
        src.person_type,
        NULLIF(BTRIM(src.tax_regime), ''),
        CASE
          WHEN jsonb_typeof(src.tax_responsibilities) = 'array' THEN src.tax_responsibilities
          ELSE '[]'::jsonb
        END,
        TRUE,
        TRUE,
        TRUE,
        'NOT_REQUIRED',
        'MANUAL',
        FALSE,
        '{}'::jsonb,
        NOW(),
        NOW()
      FROM (SELECT 1) AS seed
      LEFT JOIN LATERAL (
        SELECT c.*
        FROM customers c
        WHERE c.tenant_id = $2
          AND c.is_final_consumer = TRUE
          AND c.is_active = TRUE
        ORDER BY c.is_default DESC, c.created_at ASC, c.id ASC
        LIMIT 1
      ) AS src ON TRUE
      RETURNING id`,
      [...params, DEFAULT_FINAL_CONSUMER_NAME],
    );
    return result.rows?.length ?? 0;
  }

  private async copyUnits(client: BootstrapSqlClient, params: string[]) {
    const result = await client.query(
      `INSERT INTO units (id, tenant_id, name, abbreviation, is_active)
       SELECT gen_random_uuid(), $1, unit.name, unit.abbreviation, TRUE
       FROM (
         SELECT DISTINCT ON (UPPER(BTRIM(u.abbreviation)))
           u.name, u.abbreviation
         FROM units u
         WHERE u.tenant_id = $2
           AND u.is_active = TRUE
         ORDER BY UPPER(BTRIM(u.abbreviation)), u.name, u.id
       ) AS unit
       RETURNING id`,
      params,
    );
    return result.rows?.length ?? 0;
  }

  private async copyTaxesAndRates(client: BootstrapSqlClient, params: string[]) {
    const result = await client.query(
      `WITH source_taxes AS MATERIALIZED (
         SELECT t.id AS source_id, gen_random_uuid() AS target_id, t.name, t.rate,
                t.is_included, t.tax_type_id, t.calculation_method_id, t.tax_base_type_id
         FROM taxes t
         WHERE ${COPYABLE_TAXES_PREDICATE}
       ),
       inserted_taxes AS (
         INSERT INTO taxes (
           id, tenant_id, name, rate, is_included, is_active,
           tax_type_id, calculation_method_id, tax_base_type_id
         )
         SELECT target_id, $1, name, rate, is_included, TRUE,
                tax_type_id, calculation_method_id, tax_base_type_id
         FROM source_taxes
         RETURNING id
       ),
       inserted_rates AS (
         INSERT INTO tax_rates (
           tenant_id, tax_id, tax_product_category_id, calculation_method_id,
           tax_base_type_id, percentage_rate, fixed_amount, base_quantity,
           base_unit_code, effective_from, effective_to, is_active
         )
         SELECT $1, st.target_id, r.tax_product_category_id, r.calculation_method_id,
                r.tax_base_type_id, r.percentage_rate, r.fixed_amount, r.base_quantity,
                r.base_unit_code, r.effective_from, r.effective_to, TRUE
         FROM source_taxes st
         JOIN tax_rates r ON r.tax_id = st.source_id
         WHERE ${COPYABLE_RATE_PREDICATE}
         RETURNING id
       )
       SELECT (SELECT COUNT(*) FROM inserted_taxes) AS taxes,
              (SELECT COUNT(*) FROM inserted_rates) AS tax_rates`,
      params,
    );
    const row = result.rows?.[0] ?? {};
    return { taxes: toCount(row.taxes), taxRates: toCount(row.tax_rates) };
  }

  private async copyPaymentMethods(client: BootstrapSqlClient, params: string[]) {
    const result = await client.query(
      `INSERT INTO payment_methods (
        tenant_id, codigo, nombre, tipo, requires_reference, allows_change, active,
        icon, color, requires_financial_institution, sort_order,
        electronic_billing_enabled, electronic_payment_means_code, electronic_payment_means_id
      )
      SELECT $1, pm.codigo, pm.nombre, pm.tipo, pm.requires_reference, pm.allows_change, TRUE,
             pm.icon, pm.color, pm.requires_financial_institution, pm.sort_order,
             pm.electronic_billing_enabled, pm.electronic_payment_means_code, pm.electronic_payment_means_id
      FROM payment_methods pm
      WHERE pm.tenant_id = $2
        AND pm.active = TRUE
      RETURNING id`,
      params,
    );
    return result.rows?.length ?? 0;
  }

  private async copyPaymentMethodInstitutions(client: BootstrapSqlClient, params: string[]) {
    const result = await client.query(
      `INSERT INTO payment_method_financial_institutions (
        tenant_id, payment_method_id, financial_institution_id, active, sort_order
      )
      SELECT $1, target_pm.id, link.financial_institution_id, TRUE, link.sort_order
      FROM payment_method_financial_institutions link
      JOIN payment_methods source_pm
        ON source_pm.id = link.payment_method_id
       AND source_pm.tenant_id = $2
       AND source_pm.active = TRUE
      JOIN payment_methods target_pm
        ON target_pm.tenant_id = $1
       AND target_pm.codigo = source_pm.codigo
      JOIN financial_institutions fi
        ON fi.id = link.financial_institution_id
       AND fi.tenant_id IS NULL
       AND fi.active = TRUE
      WHERE link.tenant_id = $2
        AND link.active = TRUE
      RETURNING id`,
      params,
    );
    return result.rows?.length ?? 0;
  }

  private async verify(
    client: BootstrapSqlClient,
    params: string[],
    expected: Awaited<ReturnType<TenantBootstrapService["readExpectedCounts"]>>,
    counts: TenantBootstrapCounts,
  ) {
    const result = await client.query(
      `SELECT
        (SELECT COUNT(*) FROM menu_items WHERE tenant_id = $1 AND parent_id IS NOT NULL) AS menu_children,
        (SELECT COUNT(*)
           FROM menu_items child
           JOIN menu_items parent ON parent.id = child.parent_id
          WHERE child.tenant_id = $1 AND parent.tenant_id <> $1) AS foreign_parents,
        (SELECT COUNT(*)
           FROM role_menu_permissions rmp
           JOIN menu_items m ON m.id = rmp.menu_item_id
          WHERE rmp.tenant_id = $1 AND m.tenant_id <> $1) AS foreign_permissions,
        (SELECT COUNT(*)
           FROM menu_items
          WHERE tenant_id = $1 AND (metadata ->> 'scope') = ANY($3::text[])) AS platform_only_items,
        (SELECT COUNT(*)
           FROM payment_method_financial_institutions link
           JOIN payment_methods pm ON pm.id = link.payment_method_id
           JOIN financial_institutions fi ON fi.id = link.financial_institution_id
          WHERE link.tenant_id = $1 AND (pm.tenant_id <> $1 OR fi.tenant_id IS NOT NULL)) AS foreign_institution_links,
        (SELECT COUNT(*)
           FROM customers
          WHERE tenant_id = $1 AND is_final_consumer = TRUE AND is_default = TRUE AND is_active = TRUE) AS final_consumers,
        ($2::uuid <> $1::uuid) AS distinct_tenants`,
      [...params, [...PLATFORM_ONLY_MENU_SCOPES]],
    );
    const row = result.rows?.[0] ?? {};
    const failures: string[] = [];
    if (counts.menuItems !== expected.menuItems) failures.push("menu_items");
    if (toCount(row.menu_children) !== expected.menuChildren) failures.push("menu_hierarchy");
    if (counts.roleMenuPermissions !== expected.roleMenuPermissions) failures.push("role_menu_permissions");
    if (counts.taxes !== expected.taxes) failures.push("taxes");
    if (counts.taxRates !== expected.taxRates) failures.push("tax_rates");
    if (toCount(row.foreign_parents) > 0) failures.push("menu_foreign_parent");
    if (toCount(row.foreign_permissions) > 0) failures.push("permission_foreign_menu");
    if (toCount(row.platform_only_items) > 0) failures.push("platform_only_menu_copied");
    if (toCount(row.foreign_institution_links) > 0) failures.push("payment_institution_scope");
    if (toCount(row.final_consumers) !== 1 || counts.customers !== 1) failures.push("final_consumer");

    if (failures.length > 0) {
      throw new TenantBootstrapError(
        "TENANT_BOOTSTRAP_INTEGRITY_FAILED",
        "La verificacion del aprovisionamiento fallo",
        { failures, expected, counts },
      );
    }
  }

  private async recordAudit(
    client: BootstrapSqlClient,
    summary: TenantBootstrapSummary,
    actorUserId: string | null,
  ) {
    await client.query(
      `INSERT INTO auditoria_eventos
        (tenant_id, usuario_id, modulo, entidad, entidad_id, accion, datos_antes, datos_despues)
       VALUES ($1::uuid, $2::uuid, $3, $4, $1::uuid::text, $5, NULL, $6::jsonb)`,
      [
        summary.targetTenantId,
        actorUserId && UUID_PATTERN.test(actorUserId) ? actorUserId : null,
        TENANT_BOOTSTRAP_AUDIT.module,
        TENANT_BOOTSTRAP_AUDIT.entity,
        TENANT_BOOTSTRAP_AUDIT.completedAction,
        JSON.stringify(summary),
      ],
    );
  }
}
