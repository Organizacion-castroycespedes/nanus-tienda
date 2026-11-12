/**
 * Pruebas transaccionales reales de HU-TENANT-BOOTSTRAP-001.
 *
 * Se ejecutan solo con TENANT_BOOTSTRAP_TEST_DATABASE_URL apuntando a una base
 * DESECHABLE cuyo nombre contenga "test" (por ejemplo, una copia LOCAL creada
 * con `createdb -T manus_local manus_bootstrap_test`). Modifican el tenant
 * plataforma de esa base para cubrir casos borde. Nunca usar QA ni PRD.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { ConflictException, ServiceUnavailableException } from "@nestjs/common";
import { TenantsService } from "./tenants.service";
import { TenantBootstrapError, TenantBootstrapService } from "./tenant-bootstrap.service";

const DATABASE_URL = process.env.TENANT_BOOTSTRAP_TEST_DATABASE_URL;
const PLATFORM = "00000000-0000-0000-0000-000000000001";
const skip = !DATABASE_URL
  ? "TENANT_BOOTSTRAP_TEST_DATABASE_URL no definido"
  : !/test/i.test(new URL(DATABASE_URL).pathname)
    ? "La base de pruebas debe ser desechable y contener 'test' en el nombre"
    : false;

let pool: Pool;
const createdTenants: string[] = [];

type FailurePredicate = (text: string) => boolean;

const makeDb = (failOn?: FailurePredicate) => ({
  query: async (text: string, params?: unknown[]) => pool.query(text, params as any[]),
  getClient: async () => {
    const client = await pool.connect();
    if (!failOn) return client;
    return {
      query: async (text: string, params?: unknown[]) => {
        if (failOn(text)) throw new Error("fallo inyectado");
        return client.query(text, params as any[]);
      },
      release: () => client.release(),
    };
  },
});

const makeService = (failOn?: FailurePredicate) =>
  new TenantsService(makeDb(failOn) as any, new TenantBootstrapService());

const q = async <T = any>(text: string, params: unknown[] = []) => (await pool.query(text, params as any[])).rows as T[];
const one = async <T = any>(text: string, params: unknown[] = []) => (await q<T>(text, params))[0];
const count = async (text: string, params: unknown[] = []) => Number((await one(text, params)).count);

const sourceFingerprint = () =>
  one<{ fp: string }>(
    `SELECT md5(concat_ws('|',
      (SELECT string_agg(id::text || key || COALESCE(parent_id::text,'') || label || visible::text, ',' ORDER BY id) FROM menu_items WHERE tenant_id = $1),
      (SELECT string_agg(id::text || role_id::text || menu_item_id::text || access_level, ',' ORDER BY id) FROM role_menu_permissions WHERE tenant_id = $1),
      (SELECT string_agg(id::text || name || COALESCE(email,''), ',' ORDER BY id) FROM customers WHERE tenant_id = $1),
      (SELECT string_agg(id::text || abbreviation || is_active::text, ',' ORDER BY id) FROM units WHERE tenant_id = $1),
      (SELECT string_agg(id::text || name || rate::text || is_active::text, ',' ORDER BY id) FROM taxes WHERE tenant_id = $1),
      (SELECT string_agg(id::text || tax_id::text || effective_from::text, ',' ORDER BY id) FROM tax_rates WHERE tenant_id = $1),
      (SELECT string_agg(id::text || codigo || active::text, ',' ORDER BY id) FROM payment_methods WHERE tenant_id = $1),
      (SELECT string_agg(id::text, ',' ORDER BY id) FROM payment_method_financial_institutions WHERE tenant_id = $1)
    )) AS fp`,
    [PLATFORM],
  );

const withEnv = async <T>(vars: Record<string, string | undefined>, fn: () => Promise<T>) => {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

const uniqueName = (label: string) => `HU Bootstrap ${label} ${randomUUID().slice(0, 8)}`;

const create = async (label: string, service = makeService()) => {
  const created = await service.createTenant({ nombre: uniqueName(label) });
  createdTenants.push(created.id);
  return created;
};

before(async () => {
  if (skip) return;
  pool = new Pool({ connectionString: DATABASE_URL, max: 12 });
  // Casos borde en el tenant plataforma de la base desechable.
  await pool.query(`
    DO $$
    DECLARE
      platform uuid := '${PLATFORM}';
      control_center uuid;
      parent_cfg uuid;
      private_fi uuid := gen_random_uuid();
      qr uuid;
      iva uuid;
    BEGIN
      SELECT id INTO control_center FROM menu_items WHERE tenant_id = platform AND key = 'CONTROL_CENTER' AND deleted_at IS NULL;
      IF control_center IS NULL THEN
        RAISE EXCEPTION 'fixture requiere CONTROL_CENTER (V111)';
      END IF;
      INSERT INTO menu_items (tenant_id, key, module, label, route, parent_id, sort_order, metadata)
      VALUES (platform, 'HU_CC_CHILD', 'control-center', 'Hijo plataforma', '/{tenant}/control-center/hu-child', control_center, 1, '{}');
      INSERT INTO menu_items (tenant_id, key, module, label, route, sort_order, deleted_at)
      VALUES (platform, 'HU_DELETED', 'x', 'Eliminado', '/{tenant}/hu-deleted', 99, now());
      SELECT id INTO parent_cfg FROM menu_items WHERE tenant_id = platform AND key = 'CONFIGURACION_TENANT_CONFIGURACION';
      INSERT INTO role_menu_permissions (tenant_id, role_id, menu_item_id, access_level)
      SELECT platform, r.id, m.id, 'WRITE' FROM roles r, menu_items m
      WHERE r.nombre = 'SUPER_ADMIN' AND m.tenant_id = platform AND m.key = 'HU_CC_CHILD';

      UPDATE customers SET email = 'privado@plataforma.test', phone = '3000000000', address = 'Calle privada 1',
        fiscal_email = 'fiscal@plataforma.test', invoice_email = 'fe@plataforma.test', ciudad = 'Bogota',
        municipality_code = '11001', dian_identification_type = '13', identification_number = '222222222222',
        dian_metadata = '{"secret":"x"}'
      WHERE tenant_id = platform AND is_final_consumer = TRUE AND is_active = TRUE;
      INSERT INTO customers (id, tenant_id, name, email, is_active)
      VALUES (gen_random_uuid(), platform, 'Cliente real del origen', 'cliente@origen.test', TRUE);

      INSERT INTO units (id, tenant_id, name, abbreviation, is_active) VALUES
        (gen_random_uuid(), platform, 'Unidad duplicada', ' und ', TRUE),
        (gen_random_uuid(), platform, 'Gramo inactivo', 'GR', FALSE);

      SELECT id INTO iva FROM taxes WHERE tenant_id = platform AND name = 'IVA 19%';
      INSERT INTO tax_rates (tenant_id, tax_id, calculation_method_id, tax_base_type_id, percentage_rate, effective_from, effective_to)
      SELECT platform, t.id, t.calculation_method_id, t.tax_base_type_id, 0.16, DATE '1990-01-01', DATE '1999-12-31' FROM taxes t WHERE t.id = iva;
      INSERT INTO tax_rates (tenant_id, tax_id, calculation_method_id, tax_base_type_id, percentage_rate, effective_from)
      SELECT platform, t.id, t.calculation_method_id, t.tax_base_type_id, 0.19, (CURRENT_DATE + 400) FROM taxes t WHERE t.id = iva;
      INSERT INTO tax_rates (tenant_id, tax_id, calculation_method_id, tax_base_type_id, percentage_rate, effective_from, is_active)
      SELECT platform, t.id, t.calculation_method_id, t.tax_base_type_id, 0.10, DATE '2001-01-01', FALSE FROM taxes t WHERE t.id = iva;
      INSERT INTO taxes (id, tenant_id, name, rate, is_included, is_active)
      VALUES (gen_random_uuid(), platform, 'Impuesto legado sin clasificar', 0.08, FALSE, TRUE);

      INSERT INTO payment_methods (tenant_id, codigo, nombre, tipo, active) VALUES
        (platform, 'EFECTIVO_HU', 'Efectivo', 'CASH', TRUE),
        (platform, 'INACTIVO_HU', 'Inactivo', 'CARD', FALSE);
      INSERT INTO financial_institutions (id, tenant_id, codigo, nombre, tipo) VALUES (private_fi, platform, 'HU_PRIVADO', 'Banco privado', 'BANK');
      SELECT id INTO qr FROM payment_methods WHERE tenant_id = platform AND codigo = 'QR_BREB';
      INSERT INTO payment_method_financial_institutions (tenant_id, payment_method_id, financial_institution_id, sort_order)
      SELECT platform, qr, fi.id, fi.sort_order FROM financial_institutions fi WHERE fi.tenant_id IS NULL AND fi.codigo IN ('NEQUI', 'BANCOLOMBIA');
      INSERT INTO payment_method_financial_institutions (tenant_id, payment_method_id, financial_institution_id)
      VALUES (platform, qr, private_fi);
    END $$;
  `);
});

after(async () => {
  if (skip) return;
  for (const tenantId of createdTenants) {
    await pool.query("DELETE FROM auditoria_eventos WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM customers WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM units WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM taxes WHERE tenant_id = $1", [tenantId]);
    await pool.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
  }
  await pool.end();
});

test("crea el tenant con la configuracion base vigente y sin filtraciones", { skip }, async () => {
  const before = await sourceFingerprint();
  const globalCatalogs = await one(
    "SELECT (SELECT COUNT(*) FROM roles) roles, (SELECT COUNT(*) FROM tax_types) types, (SELECT COUNT(*) FROM financial_institutions WHERE tenant_id IS NULL) fis",
  );
  const expectedMenu = await count(
    `SELECT COUNT(*) FROM menu_items WHERE tenant_id = $1 AND deleted_at IS NULL AND key NOT IN ('CONTROL_CENTER', 'HU_CC_CHILD')`,
    [PLATFORM],
  );
  const expectedPermissions = await count(
    `SELECT COUNT(*) FROM role_menu_permissions rmp JOIN menu_items m ON m.id = rmp.menu_item_id
     WHERE rmp.tenant_id = $1 AND m.deleted_at IS NULL AND m.key NOT IN ('CONTROL_CENTER', 'HU_CC_CHILD')`,
    [PLATFORM],
  );

  const created = await create("ok");
  const t = created.id;

  assert.equal(created.bootstrap.status, "COMPLETED");
  assert.equal(created.bootstrap.sourceTenantId, PLATFORM);

  // Menús y jerarquía.
  assert.equal(await count("SELECT COUNT(*) FROM menu_items WHERE tenant_id = $1", [t]), expectedMenu);
  assert.equal(created.bootstrap.counts.menuItems, expectedMenu);
  assert.equal(
    await count("SELECT COUNT(*) FROM menu_items WHERE tenant_id = $1 AND key IN ('CONTROL_CENTER','HU_CC_CHILD','HU_DELETED')", [t]),
    0,
  );
  const hierarchyMismatch = await count(
    `SELECT COUNT(*) FROM menu_items s
     LEFT JOIN menu_items sp ON sp.id = s.parent_id
     JOIN menu_items tm ON tm.tenant_id = $2 AND tm.key = s.key
     LEFT JOIN menu_items tp ON tp.id = tm.parent_id
     WHERE s.tenant_id = $1 AND s.deleted_at IS NULL
       AND COALESCE(sp.key, '') <> COALESCE(tp.key, '')`,
    [PLATFORM, t],
  );
  assert.equal(hierarchyMismatch, 0);
  assert.equal(
    await count(
      `SELECT COUNT(*) FROM menu_items tm JOIN menu_items sm ON sm.id = tm.id WHERE tm.tenant_id = $1 AND sm.tenant_id = $2`,
      [t, PLATFORM],
    ),
    0,
    "los UUID de menu deben ser nuevos",
  );

  // Permisos con role_id global y menu remapeado.
  assert.equal(await count("SELECT COUNT(*) FROM role_menu_permissions WHERE tenant_id = $1", [t]), expectedPermissions);
  assert.equal(
    await count(
      `SELECT COUNT(*) FROM role_menu_permissions rmp JOIN menu_items m ON m.id = rmp.menu_item_id
       WHERE rmp.tenant_id = $1 AND m.tenant_id <> $1`,
      [t],
    ),
    0,
  );
  const permissionDiff = await count(
    `SELECT COUNT(*) FROM (
       SELECT r.nombre, m.key, rmp.access_level, rmp.actions FROM role_menu_permissions rmp
       JOIN roles r ON r.id = rmp.role_id JOIN menu_items m ON m.id = rmp.menu_item_id
       WHERE rmp.tenant_id = $1 AND m.deleted_at IS NULL AND m.key NOT IN ('CONTROL_CENTER','HU_CC_CHILD')
       EXCEPT
       SELECT r.nombre, m.key, rmp.access_level, rmp.actions FROM role_menu_permissions rmp
       JOIN roles r ON r.id = rmp.role_id JOIN menu_items m ON m.id = rmp.menu_item_id
       WHERE rmp.tenant_id = $2
     ) diff`,
    [PLATFORM, t],
  );
  assert.equal(permissionDiff, 0);

  // Consumidor final.
  const consumers = await q("SELECT * FROM customers WHERE tenant_id = $1", [t]);
  assert.equal(consumers.length, 1);
  const consumer = consumers[0];
  assert.equal(consumer.is_final_consumer, true);
  assert.equal(consumer.is_default, true);
  assert.equal(consumer.is_active, true);
  assert.equal(consumer.dian_identification_type, "13");
  assert.equal(consumer.identification_number, "222222222222");
  for (const column of ["email", "phone", "address", "fiscal_email", "invoice_email", "ciudad", "municipality_code", "municipio_id", "departamento_id"]) {
    assert.equal(consumer[column], null, `${column} no debe copiarse`);
  }
  assert.deepEqual(consumer.dian_metadata, {});
  assert.equal(consumer.fiscal_status, "NOT_REQUIRED");

  // Unidades: activas y sin duplicados por abreviatura.
  const units = await q<{ abbreviation: string }>("SELECT abbreviation FROM units WHERE tenant_id = $1", [t]);
  const abbreviations = units.map((u) => u.abbreviation.trim().toUpperCase());
  assert.equal(new Set(abbreviations).size, abbreviations.length);
  assert.ok(abbreviations.includes("UND"));
  assert.ok(!abbreviations.includes("GR"));

  // Impuestos y tarifas.
  const taxNames = (await q<{ name: string }>("SELECT name FROM taxes WHERE tenant_id = $1", [t])).map((r) => r.name);
  assert.ok(taxNames.includes("IVA 19%"));
  assert.ok(!taxNames.includes("Impuesto legado sin clasificar"));
  assert.ok(
    created.bootstrap.manual.some((m: any) => m.table === "taxes" && m.items.includes("Impuesto legado sin clasificar")),
  );
  const ivaRates = await q<{ percentage_rate: string; effective_from: Date }>(
    `SELECT r.percentage_rate, r.effective_from FROM tax_rates r JOIN taxes x ON x.id = r.tax_id
     WHERE r.tenant_id = $1 AND x.name = 'IVA 19%' ORDER BY r.effective_from`,
    [t],
  );
  assert.equal(ivaRates.length, 2, "vigente + futura; sin vencida ni inactiva");
  assert.ok(ivaRates.every((rate) => Number(rate.percentage_rate) === 0.19));
  const rateDiff = await count(
    `SELECT COUNT(*) FROM (
       SELECT x.name, r.tax_product_category_id, r.percentage_rate, r.fixed_amount, r.effective_from, r.effective_to
       FROM tax_rates r JOIN taxes x ON x.id = r.tax_id
       WHERE r.tenant_id = $1 AND r.is_active AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
         AND x.is_active AND x.tax_type_id IS NOT NULL
       EXCEPT
       SELECT x.name, r.tax_product_category_id, r.percentage_rate, r.fixed_amount, r.effective_from, r.effective_to
       FROM tax_rates r JOIN taxes x ON x.id = r.tax_id WHERE r.tenant_id = $2
     ) diff`,
    [PLATFORM, t],
  );
  assert.equal(rateDiff, 0);

  // Métodos de pago y entidades globales.
  const methods = (await q<{ codigo: string }>("SELECT codigo FROM payment_methods WHERE tenant_id = $1", [t])).map((r) => r.codigo);
  assert.ok(methods.includes("QR_BREB") && methods.includes("EFECTIVO_HU"));
  assert.ok(!methods.includes("INACTIVO_HU"));
  const links = await q<{ codigo: string; tenant_id: string | null }>(
    `SELECT fi.codigo, fi.tenant_id FROM payment_method_financial_institutions l
     JOIN financial_institutions fi ON fi.id = l.financial_institution_id WHERE l.tenant_id = $1`,
    [t],
  );
  assert.deepEqual(links.map((l) => l.codigo).sort(), ["BANCOLOMBIA", "NEQUI"]);
  assert.ok(links.every((l) => l.tenant_id === null));

  // Exclusiones: nada operativo ni de configuración propia del origen.
  for (const table of ["tenant_settings", "tenants_detalles", "tenant_branches", "users", "user_roles", "pos_terminals", "products", "tenant_electronic_billing_configs", "permissions", "financial_institutions"]) {
    assert.equal(await count(`SELECT COUNT(*) FROM ${table} WHERE tenant_id = $1`, [t]), 0, `${table} debe quedar vacio`);
  }

  // Auditoría dentro de la misma transacción.
  const audit = await q("SELECT * FROM auditoria_eventos WHERE tenant_id = $1 AND accion = 'TENANT_BOOTSTRAP_COMPLETED'", [t]);
  assert.equal(audit.length, 1);
  assert.equal(audit[0].datos_despues.counts.menuItems, expectedMenu);

  // El origen y los catálogos globales no cambian.
  assert.equal((await sourceFingerprint()).fp, before.fp);
  assert.deepEqual(
    await one(
      "SELECT (SELECT COUNT(*) FROM roles) roles, (SELECT COUNT(*) FROM tax_types) types, (SELECT COUNT(*) FROM financial_institutions WHERE tenant_id IS NULL) fis",
    ),
    globalCatalogs,
  );
});

test("un fallo intermedio revierte el tenant y todo lo copiado", { skip }, async () => {
  const name = uniqueName("rollback");
  const tenantsBefore = await count("SELECT COUNT(*) FROM tenants");
  const menuBefore = await count("SELECT COUNT(*) FROM menu_items");
  const service = makeService((text) => text.includes("INSERT INTO role_menu_permissions"));
  await assert.rejects(() => service.createTenant({ nombre: name }), /fallo inyectado/);
  assert.equal(await count("SELECT COUNT(*) FROM tenants WHERE nombre = $1", [name]), 0);
  assert.equal(await count("SELECT COUNT(*) FROM tenants"), tenantsBefore);
  assert.equal(await count("SELECT COUNT(*) FROM menu_items"), menuBefore);
});

test("origen faltante, inactivo o incompleto aborta sin crear el tenant", { skip }, async () => {
  const name = uniqueName("missing");
  await withEnv({ PLATFORM_TENANT_ID: randomUUID() }, async () => {
    await assert.rejects(() => makeService().createTenant({ nombre: name }), ServiceUnavailableException);
  });
  assert.equal(await count("SELECT COUNT(*) FROM tenants WHERE nombre = $1", [name]), 0);

  const emptySource = await one<{ id: string }>(
    "INSERT INTO tenants (slug, nombre, activo, config) VALUES ($1, $1, TRUE, '{}') RETURNING id",
    [`hu-empty-source-${randomUUID().slice(0, 8)}`],
  );
  createdTenants.push(emptySource.id);
  const incomplete = uniqueName("incomplete");
  await withEnv({ PLATFORM_TENANT_ID: emptySource.id }, async () => {
    await assert.rejects(
      () => makeService().createTenant({ nombre: incomplete }),
      (error: any) =>
        error instanceof ServiceUnavailableException &&
        (error.getResponse() as { code?: string }).code === "TENANT_BOOTSTRAP_SOURCE_INCOMPLETE",
    );
  });
  await pool.query("UPDATE tenants SET activo = FALSE WHERE id = $1", [emptySource.id]);
  await withEnv({ PLATFORM_TENANT_ID: emptySource.id }, async () => {
    await assert.rejects(
      () => makeService().createTenant({ nombre: incomplete }),
      (error: any) => error.getResponse()?.code === "TENANT_BOOTSTRAP_SOURCE_INACTIVE",
    );
  });
  assert.equal(await count("SELECT COUNT(*) FROM tenants WHERE nombre = $1", [incomplete]), 0);
});

test("altas concurrentes quedan completas y aisladas; slug duplicado no deja residuos", { skip }, async () => {
  const results = await Promise.all([1, 2, 3, 4, 5].map((i) => create(`conc-${i}`)));
  const expectedMenu = results[0].bootstrap.counts.menuItems;
  for (const created of results) {
    assert.equal(created.bootstrap.status, "COMPLETED");
    assert.equal(await count("SELECT COUNT(*) FROM menu_items WHERE tenant_id = $1", [created.id]), expectedMenu);
    assert.equal(await count("SELECT COUNT(*) FROM customers WHERE tenant_id = $1", [created.id]), 1);
  }

  const slug = `hu-race-${randomUUID().slice(0, 8)}`;
  const settled = await Promise.allSettled([
    makeService().createTenant({ nombre: "Race A", slug }),
    makeService().createTenant({ nombre: "Race B", slug }),
  ]);
  const fulfilled = settled.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
  const rejected = settled.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
  fulfilled.forEach((r) => createdTenants.push(r.value.id));
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].reason instanceof ConflictException);
  assert.equal(await count("SELECT COUNT(*) FROM tenants WHERE slug = $1", [slug]), 1);
  assert.equal(
    await count("SELECT COUNT(*) FROM menu_items m WHERE NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = m.tenant_id)"),
    0,
  );
});

test("reintento idempotente y tenant parcialmente inicializado", { skip }, async () => {
  const created = await create("idem");
  const bootstrapService = new TenantBootstrapService();
  const runAgain = async (targetTenantId: string) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      const summary = await bootstrapService.bootstrap(client, { targetTenantId, sourceTenantId: PLATFORM });
      await client.query("COMMIT");
      return summary;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };

  const menuBefore = await count("SELECT COUNT(*) FROM menu_items WHERE tenant_id = $1", [created.id]);
  const again = await runAgain(created.id);
  assert.equal(again.status, "ALREADY_COMPLETED");
  assert.equal(await count("SELECT COUNT(*) FROM menu_items WHERE tenant_id = $1", [created.id]), menuBefore);
  assert.equal(
    await count("SELECT COUNT(*) FROM auditoria_eventos WHERE tenant_id = $1 AND accion = 'TENANT_BOOTSTRAP_COMPLETED'", [created.id]),
    1,
  );

  // Alta sin aprovisionamiento (kill switch) y luego aprovisionamiento explícito.
  const legacy = await withEnv({ TENANT_BOOTSTRAP_ENABLED: "false" }, () =>
    makeService().createTenant({ nombre: uniqueName("legacy") }),
  );
  createdTenants.push(legacy.id);
  assert.equal(legacy.bootstrap, undefined);
  assert.equal((await runAgain(legacy.id)).status, "COMPLETED");

  // Parcial: tiene datos gestionados pero no la marca de finalización.
  const partial = await withEnv({ TENANT_BOOTSTRAP_ENABLED: "false" }, () =>
    makeService().createTenant({ nombre: uniqueName("partial") }),
  );
  createdTenants.push(partial.id);
  await pool.query(
    "INSERT INTO units (id, tenant_id, name, abbreviation, is_active) VALUES (gen_random_uuid(), $1, 'Unidad', 'UND', TRUE)",
    [partial.id],
  );
  await assert.rejects(
    () => runAgain(partial.id),
    (error: unknown) => error instanceof TenantBootstrapError && error.code === "TENANT_BOOTSTRAP_TARGET_NOT_EMPTY",
  );
  assert.equal(await count("SELECT COUNT(*) FROM menu_items WHERE tenant_id = $1", [partial.id]), 0);
});

test("impuestos ambiguos del origen se excluyen y quedan para revision manual", { skip }, async () => {
  const duplicate = await one<{ id: string }>(
    `INSERT INTO taxes (id, tenant_id, name, rate, is_included, is_active, tax_type_id, calculation_method_id, tax_base_type_id)
     SELECT gen_random_uuid(), tenant_id, ' iva 19% ', rate, NOT is_included, TRUE, tax_type_id, calculation_method_id, tax_base_type_id
     FROM taxes WHERE tenant_id = $1 AND name = 'IVA 19%' RETURNING id`,
    [PLATFORM],
  );
  try {
    const created = await create("ambiguous");
    const names = (await q<{ name: string }>("SELECT name FROM taxes WHERE tenant_id = $1", [created.id])).map((r) =>
      r.name.trim().toUpperCase(),
    );
    assert.ok(!names.includes("IVA 19%"));
    const manualTaxes = created.bootstrap.manual.find((m: any) => m.table === "taxes");
    assert.ok(manualTaxes.items.filter((n: string) => n.trim().toUpperCase() === "IVA 19%").length === 2);
  } finally {
    await pool.query("DELETE FROM taxes WHERE id = $1", [duplicate.id]);
  }
});
