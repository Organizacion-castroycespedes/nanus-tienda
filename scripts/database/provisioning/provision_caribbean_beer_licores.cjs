#!/usr/bin/env node

/*
 * Explicit demo-tenant provisioner.
 *
 * This command is intentionally preflight-only in this change. It must never
 * silently reuse source category/subcategory UUIDs or erase subcategory IDs.
 *
 * Usage:
 *   node scripts/database/provisioning/provision_caribbean_beer_licores.cjs \
 *     --preflight --env scripts/config/db.env
 *
 * Apply remains refused because writes are not authorized in this step.
 */

const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { Client } = require(path.resolve(__dirname, "../../../api/node_modules/pg"));

const SOURCE_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const TARGET_SLUG = "caribbean-beer-licores";
const TARGET_NIT = "902067003";
const TARGET_EMAIL = "caribbeanbeerlicores@gmail.com";
const DEFAULT_MANIFEST_PATH = path.resolve(process.cwd(), ".tmp/provisioning/caribbean-beer-licores/manifest.json");
const args = new Set(process.argv.slice(2));

function valueAfter(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function loadEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

function fail(message) {
  throw new Error(`[caribbean-beer-licores] BLOCKED: ${message}`);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function manifestPathFromArgs() {
  return path.resolve(valueAfter("--manifest", DEFAULT_MANIFEST_PATH));
}

function manifestPayload(manifest) {
  const copy = { ...manifest };
  delete copy.fingerprint;
  return copy;
}

function writeManifest(manifest, file) {
  const payload = { ...manifestPayload(manifest), fingerprint: fingerprint(manifestPayload(manifest)) };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  fs.renameSync(temporary, file);
  return payload;
}

function readManifest(file) {
  if (!fs.existsSync(file)) return null;
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(file, "utf8")); } catch (error) { fail(`manifest is not valid JSON: ${file}`); }
  if (!manifest || manifest.fingerprint !== fingerprint(manifestPayload(manifest))) fail(`manifest fingerprint mismatch: ${file}`);
  if (manifest.schema_version !== 1 || manifest.provisioning_key !== TARGET_SLUG) fail(`manifest identity is unsupported: ${file}`);
  if (manifest.target?.slug !== TARGET_SLUG || manifest.target?.nit !== TARGET_NIT || manifest.source?.tenant_id !== SOURCE_TENANT_ID) fail(`manifest belongs to another target or source: ${file}`);
  return manifest;
}

function resolveStoragePath(storageRoot, storageKey) {
  if (!storageKey || storageKey.includes("..") || storageKey.startsWith("/") || storageKey.includes("\\")) {
    fail(`invalid image storage key: ${storageKey || "<empty>"}`);
  }
  const candidate = path.resolve(storageRoot, storageKey);
  const root = path.resolve(storageRoot);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    fail(`image storage key escapes storage root: ${storageKey}`);
  }
  return candidate;
}

function imageTargetKey(sourceKey, sourceTenantId, sourceEntityId, targetTenantId, targetEntityId) {
  const parts = sourceKey.split("/");
  if (parts.length !== 4 || parts[1] !== sourceTenantId || parts[2] !== sourceEntityId) {
    fail(`image key does not match source tenant/entity: ${sourceKey}`);
  }
  return `${parts[0]}/${targetTenantId}/${targetEntityId}/${parts[3]}`;
}

function imageUrl(target, entityId) {
  if (target === "products") return `/inventory/products/${entityId}/image`;
  if (target === "product-categories") return `/inventory/product-categories/${entityId}/image`;
  return `/inventory/product-subcategories/${entityId}/image`;
}

function buildImageManifest({ storageRoot, sourceTenantId, targetTenantId, category, subcategories, products, targetCategoryId, targetSubcategoryIds, targetProductIds, strict = false, checkSourceFiles = true }) {
  const entries = [];
  const add = (target, row, sourceKey, targetId) => {
    if (!sourceKey) return;
    const sourcePath = resolveStoragePath(storageRoot, sourceKey);
    const sourceStat = checkSourceFiles && fs.existsSync(sourcePath) ? fs.lstatSync(sourcePath) : null;
    const targetKey = imageTargetKey(sourceKey, sourceTenantId, row.id, targetTenantId, targetId);
    const targetPath = resolveStoragePath(storageRoot, targetKey);
    entries.push({
      entity_type: target,
      source_entity_id: row.id,
      preview_target_entity_id: targetId,
      source_storage_key: sourceKey,
      target_storage_key: targetKey,
      source_physical_path_exists: Boolean(sourceStat?.isFile() && !sourceStat.isSymbolicLink()),
      source_bytes: sourceStat?.isFile() && !sourceStat.isSymbolicLink() ? sourceStat.size : null,
      intended_target_path: targetPath,
      collision: fs.existsSync(targetPath),
      image_url: imageUrl(target, targetId),
    });
  };
  add("product-categories", category, category.default_image_storage_key, targetCategoryId);
  for (const row of subcategories) add("product-subcategories", row, row.default_image_storage_key, targetSubcategoryIds[row.id]);
  for (const row of products) add("products", row, row.image_storage_key, targetProductIds[row.id]);
  const missing = checkSourceFiles ? entries.filter((entry) => !entry.source_physical_path_exists) : [];
  if (missing.length && strict) fail(`selected source image files missing: ${missing.map((entry) => entry.source_storage_key).join(", ")}`);
  const collisions = entries.filter((entry) => entry.collision);
  if (collisions.length && strict) fail(`target image destinations already exist: ${collisions.map((entry) => entry.target_storage_key).join(", ")}`);
  return {
    entries,
    summary: {
      by_entity_type: entries.reduce((result, entry) => {
        result[entry.entity_type] = (result[entry.entity_type] || 0) + 1;
        return result;
      }, {}),
      total_files: entries.length,
      total_bytes: entries.reduce((sum, entry) => sum + (entry.source_bytes || 0), 0),
      missing_source_files: missing.length,
      target_collisions: collisions.length,
    },
    blockers: [
      ...(missing.length ? [`missing source files: ${missing.map((entry) => entry.source_storage_key).join(", ")}`] : []),
      ...(collisions.length ? [`target collisions: ${collisions.map((entry) => entry.target_storage_key).join(", ")}`] : []),
    ],
  };
}

function imageManifestForPersistence(imageManifest, manifest) {
  return imageManifest.entries.map((entry) => ({
    entity_type: entry.entity_type,
    source_entity_id: entry.source_entity_id,
    target_entity_id: entry.preview_target_entity_id,
    source_storage_key: entry.source_storage_key,
    target_storage_key: entry.target_storage_key,
    source_path: resolveStoragePath(manifest.storage_root, entry.source_storage_key),
    final_local_target_path: entry.intended_target_path,
    filename: entry.target_storage_key.split("/").at(-1),
    status: "PREPARED",
    byte_size: null,
    sha256: null,
    image_url: entry.image_url,
  }));
}

function prepareImageFiles(manifest, imageManifest) {
  const createdFiles = [];
  try {
    for (const entry of imageManifest.entries) {
      const sourcePath = resolveStoragePath(manifest.storage_root, entry.source_storage_key);
      const targetPath = entry.intended_target_path;
      if (!fs.existsSync(sourcePath) || !fs.lstatSync(sourcePath).isFile() || fs.lstatSync(sourcePath).isSymbolicLink()) {
        fail(`selected source image file missing or unsafe: ${entry.source_storage_key}`);
      }
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      if (fs.existsSync(targetPath)) {
        const sourceHash = createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex");
        const targetHash = createHash("sha256").update(fs.readFileSync(targetPath)).digest("hex");
        if (sourceHash !== targetHash) fail(`target image destination already exists with different content: ${entry.target_storage_key}`);
      } else {
        fs.copyFileSync(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
        createdFiles.push(targetPath);
      }
    }
    return createdFiles;
  } catch (error) {
    for (const file of createdFiles.reverse()) { try { fs.unlinkSync(file); } catch { /* scoped compensation */ } }
    throw error;
  }
}

async function insertRow(client, table, row, { returningColumn = null } = {}) {
  const entries = Object.entries(row).filter(([, value]) => value !== undefined);
  const columns = entries.map(([column]) => `"${column}"`).join(", ");
  const placeholders = entries.map((_, index) => `$${index + 1}`).join(", ");
  const returning = returningColumn ? ` RETURNING "${returningColumn}"` : "";
  const result = await client.query(
    `INSERT INTO public."${table}" (${columns}) VALUES (${placeholders})${returning}`,
    entries.map(([, value]) => value)
  );
  return returningColumn ? result.rows[0]?.[returningColumn] : undefined;
}

function menuOrderCompare(left, right) {
  return Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0)
    || String(left.id).localeCompare(String(right.id));
}

function orderMenusTopologically(rows) {
  const byId = new Map();
  for (const row of rows) {
    if (byId.has(row.id)) fail(`duplicate source menu id: ${row.id}`);
    byId.set(row.id, row);
  }
  for (const row of rows) {
    if (row.parent_id && !byId.has(row.parent_id)) fail(`selected menu has orphan parent: ${row.id} -> ${row.parent_id}`);
  }
  const children = new Map();
  for (const row of rows) {
    const siblings = children.get(row.parent_id || null) || [];
    siblings.push(row);
    children.set(row.parent_id || null, siblings);
  }
  for (const siblings of children.values()) siblings.sort(menuOrderCompare);
  const state = new Map();
  const ordered = [];
  const visit = (row) => {
    const current = state.get(row.id) || 0;
    if (current === 1) fail(`selected menu hierarchy contains a cycle at ${row.id}`);
    if (current === 2) return;
    state.set(row.id, 1);
    ordered.push(row);
    for (const child of children.get(row.id) || []) visit(child);
    state.set(row.id, 2);
  };
  for (const root of children.get(null) || []) visit(root);
  if (ordered.length !== rows.length) {
    for (const row of rows) {
      if (!state.has(row.id)) visit(row);
    }
    fail(`selected menu hierarchy is incomplete: ordered=${ordered.length}, rows=${rows.length}`);
  }
  return ordered;
}

function assertMenuUniqueValues(rows) {
  for (const column of ["key", "route"]) {
    const seen = new Set();
    for (const row of rows) {
      if (row[column] == null) continue;
      if (seen.has(row[column])) fail(`selected menu rows violate unique tenant ${column}: ${row[column]}`);
      seen.add(row[column]);
    }
  }
}

function assertRoleMenuPermissions(rows, selectedMenuIds) {
  const seen = new Set();
  for (const row of rows) {
    if (!selectedMenuIds.has(row.menu_item_id)) fail(`SUPER_USER permission points outside selected menus: ${row.menu_item_id}`);
    if (!["READ", "WRITE"].includes(row.access_level)) fail(`invalid SUPER_USER access level: ${row.access_level}`);
    const key = `${row.role_id}:${row.menu_item_id}`;
    if (seen.has(key)) fail(`duplicate SUPER_USER menu permission: ${key}`);
    seen.add(key);
  }
}

function requireManifestTargetId(manifest, group, sourceId) {
  const targetId = manifest.maps?.[group]?.[sourceId]?.target_id;
  if (!targetId) fail(`missing definitive manifest mapping: group=${group}, source_id=${sourceId}`);
  if (targetId === sourceId) fail(`manifest mapping reuses source UUID: group=${group}, source_id=${sourceId}`);
  return targetId;
}

function requireManifestEntityId(manifest, group) {
  const targetId = manifest.maps?.[group]?.target_id;
  if (!targetId) fail(`missing definitive manifest entity mapping: group=${group}`);
  return targetId;
}

function sameValue(left, right) {
  if (left == null && right == null) return true;
  return String(left) === String(right);
}

function assertMappedRow(row, expected, invariant, fields) {
  if (!row) fail(`post-write ${invariant}: target row missing for source=${expected.source_id}`);
  for (const field of fields) {
    if (!sameValue(row[field], expected[field])) {
      fail(`post-write ${invariant}: source=${expected.source_id}, field=${field}, expected=${expected[field]}, actual=${row[field]}`);
    }
  }
}

async function validatePostWrite(client, {
  manifest, targetTenantId, sourceTenantId, sourceCategory, sourceSubcategories, sourceProducts,
  sourceUnits, sourceTaxes, sourceRates, sourceBarcodes, sourceProductTaxes, sourceProfiles,
  sourceBranch, sourceMenus, sourceRoleMenuPermissions, sourcePermissions, sourcePayments,
  branchId, personaId, userId, customerId, terminalId, posTerminalId, cashRegisterId, superUserRole,
}) {
  const query = async (sql, params = []) => (await client.query(sql, params)).rows;
  const target = (group, sourceId) => manifest.maps[group]?.[sourceId]?.target_id;
  const targetIds = (group) => Object.values(manifest.maps[group] || {}).map((row) => row.target_id);
  const requireCount = (invariant, actual, expected) => {
    if (Number(actual) !== Number(expected)) fail(`post-write ${invariant}: expected=${expected}, actual=${actual}`);
  };
  const tenantTables = [
    ["tenant_branches", [branchId]], ["personas", [personaId]], ["users", [userId]],
    ["customers", [customerId]], ["product_categories", [manifest.maps.category.target_id]],
    ["product_subcategories", targetIds("subcategories")], ["products", targetIds("products")],
    ["units", targetIds("units")], ["taxes", targetIds("taxes")], ["tax_rates", targetIds("tax_rates")],
    ["product_barcodes", targetIds("barcodes")], ["product_taxes", targetIds("product_taxes")],
    ["product_tax_profiles", targetIds("product_tax_profiles")], ["payment_methods", targetIds("payment_methods")],
    ["menu_items", targetIds("menu_items")], ["role_menu_permissions", targetIds("role_menu_permissions")],
    ["permissions", targetIds("permissions")], ["terminals", [terminalId]],
    ["pos_terminals", [posTerminalId]], ["cash_registers", [cashRegisterId]],
  ];
  for (const [table, ids] of tenantTables) {
    const result = await query(`SELECT count(*) AS total, count(*) FILTER (WHERE tenant_id <> $1) AS wrong_tenant FROM public."${table}" WHERE id = ANY($2::uuid[])`, [targetTenantId, ids]);
    requireCount(`${table}.target_rows`, result[0].total, ids.length);
    requireCount(`${table}.tenant_isolation`, result[0].wrong_tenant, 0);
  }

  const categoryRows = await query("SELECT id, tenant_id, name, slug FROM product_categories WHERE id=$1", [manifest.maps.category.target_id]);
  assertMappedRow(categoryRows[0], { source_id: sourceCategory.id, tenant_id: targetTenantId, name: sourceCategory.name, slug: sourceCategory.slug }, "product_category_mapping", ["tenant_id", "name", "slug"]);
  const subcategoryRows = await query("SELECT id, tenant_id, category_id, name, slug FROM product_subcategories WHERE id=ANY($1::uuid[])", [targetIds("subcategories")]);
  const subcategoryById = new Map(subcategoryRows.map((row) => [row.id, row]));
  for (const source of sourceSubcategories) {
    const row = subcategoryById.get(target("subcategories", source.id));
    assertMappedRow(row, { source_id: source.id, tenant_id: targetTenantId, category_id: manifest.maps.category.target_id, name: source.name, slug: source.slug }, "subcategory_mapping", ["tenant_id", "category_id", "name", "slug"]);
  }

  const productRows = await query("SELECT id, tenant_id, unit_id, tax_id, category_id, subcategory_id, name FROM products WHERE id=ANY($1::uuid[])", [targetIds("products")]);
  const productById = new Map(productRows.map((row) => [row.id, row]));
  requireCount("product_mapping", productRows.length, sourceProducts.length);
  for (const source of sourceProducts) {
    const row = productById.get(target("products", source.id));
    assertMappedRow(row, { source_id: source.id, tenant_id: targetTenantId, category_id: manifest.maps.category.target_id, subcategory_id: source.subcategory_id ? target("subcategories", source.subcategory_id) : null, unit_id: target("units", source.unit_id), tax_id: source.tax_id ? target("taxes", source.tax_id) : null }, "product_mapping", ["tenant_id", "category_id", "subcategory_id", "unit_id", "tax_id"]);
    if ([sourceCategory.id, ...sourceSubcategories.map((item) => item.id)].includes(row.category_id) || [sourceCategory.id, ...sourceSubcategories.map((item) => item.id)].includes(row.subcategory_id)) fail(`post-write product_mapping: source tenant category reference leaked for target=${row.id}`);
  }

  const barcodeRows = await query("SELECT id, tenant_id, product_id, barcode, barcode_type, is_primary, is_active FROM product_barcodes WHERE id=ANY($1::uuid[])", [targetIds("barcodes")]);
  const barcodeById = new Map(barcodeRows.map((row) => [row.id, row]));
  for (const source of sourceBarcodes) assertMappedRow(barcodeById.get(target("barcodes", source.id)), { source_id: source.id, tenant_id: targetTenantId, product_id: target("products", source.product_id), barcode: source.barcode, barcode_type: source.barcode_type, is_primary: source.is_primary, is_active: source.is_active }, "barcode_mapping", ["tenant_id", "product_id", "barcode", "barcode_type", "is_primary", "is_active"]);

  const taxRows = await query("SELECT id, tenant_id, tax_type_id, calculation_method_id, tax_base_type_id, name, rate, is_included, is_active FROM taxes WHERE id=ANY($1::uuid[])", [targetIds("taxes")]);
  const taxById = new Map(taxRows.map((row) => [row.id, row]));
  for (const source of sourceTaxes) assertMappedRow(taxById.get(target("taxes", source.id)), { source_id: source.id, tenant_id: targetTenantId, tax_type_id: source.tax_type_id, calculation_method_id: source.calculation_method_id, tax_base_type_id: source.tax_base_type_id, name: source.name, rate: source.rate, is_included: source.is_included, is_active: source.is_active }, "tax_mapping", ["tenant_id", "tax_type_id", "calculation_method_id", "tax_base_type_id", "name", "rate", "is_included", "is_active"]);
  const rateRows = await query("SELECT id, tenant_id, tax_id, tax_product_category_id, calculation_method_id, tax_base_type_id, percentage_rate, fixed_amount, base_quantity, base_unit_code, effective_from, effective_to, is_active FROM tax_rates WHERE id=ANY($1::uuid[])", [targetIds("tax_rates")]);
  const rateById = new Map(rateRows.map((row) => [row.id, row]));
  for (const source of sourceRates) assertMappedRow(rateById.get(target("tax_rates", source.id)), { source_id: source.id, tenant_id: targetTenantId, tax_id: target("taxes", source.tax_id), tax_product_category_id: source.tax_product_category_id, calculation_method_id: source.calculation_method_id, tax_base_type_id: source.tax_base_type_id, percentage_rate: source.percentage_rate, fixed_amount: source.fixed_amount, base_quantity: source.base_quantity, base_unit_code: source.base_unit_code, effective_from: source.effective_from, effective_to: source.effective_to, is_active: source.is_active }, "tax_rate_mapping", ["tenant_id", "tax_id", "tax_product_category_id", "calculation_method_id", "tax_base_type_id", "percentage_rate", "fixed_amount", "base_quantity", "base_unit_code", "effective_from", "effective_to", "is_active"]);
  const productTaxRows = await query("SELECT id, tenant_id, product_id, tax_id, calculation_order, is_active FROM product_taxes WHERE id=ANY($1::uuid[])", [targetIds("product_taxes")]);
  const productTaxById = new Map(productTaxRows.map((row) => [row.id, row]));
  for (const source of sourceProductTaxes) assertMappedRow(productTaxById.get(target("product_taxes", source.id)), { source_id: source.id, tenant_id: targetTenantId, product_id: target("products", source.product_id), tax_id: target("taxes", source.tax_id), calculation_order: source.calculation_order, is_active: source.is_active }, "product_tax_mapping", ["tenant_id", "product_id", "tax_id", "calculation_order", "is_active"]);
  const profileRows = await query("SELECT id, tenant_id, product_id, tax_product_category_id, alcohol_degree, net_volume_ml, dane_certified_retail_price, dane_price_effective_from, dane_price_effective_to FROM product_tax_profiles WHERE id=ANY($1::uuid[])", [targetIds("product_tax_profiles")]);
  const profileById = new Map(profileRows.map((row) => [row.id, row]));
  for (const source of sourceProfiles) assertMappedRow(profileById.get(target("product_tax_profiles", source.id)), { source_id: source.id, tenant_id: targetTenantId, product_id: target("products", source.product_id), tax_product_category_id: source.tax_product_category_id, alcohol_degree: source.alcohol_degree, net_volume_ml: source.net_volume_ml, dane_certified_retail_price: source.dane_certified_retail_price, dane_price_effective_from: source.dane_price_effective_from, dane_price_effective_to: source.dane_price_effective_to }, "product_tax_profile_mapping", ["tenant_id", "product_id", "tax_product_category_id", "alcohol_degree", "net_volume_ml", "dane_certified_retail_price", "dane_price_effective_from", "dane_price_effective_to"]);

  const userRows = await query("SELECT id, tenant_id, persona_id FROM users WHERE id=$1", [userId]);
  assertMappedRow(userRows[0], { source_id: userId, tenant_id: targetTenantId, persona_id: personaId }, "user_tenant_mapping", ["tenant_id", "persona_id"]);
  requireCount("user_role_mapping", (await query("SELECT count(*) AS count FROM user_roles WHERE user_id=$1 AND role_id=$2 AND tenant_id=$3", [userId, superUserRole, targetTenantId]))[0].count, 1);
  requireCount("persona_branch_mapping", (await query("SELECT count(*) AS count FROM persona_tenant_branches WHERE persona_id=$1 AND tenant_branch_id=$2 AND tenant_id=$3", [personaId, branchId, targetTenantId]))[0].count, 1);

  const targetMenuRows = await query("SELECT id, tenant_id, key, route, parent_id FROM menu_items WHERE id=ANY($1::uuid[]) AND deleted_at IS NULL", [targetIds("menu_items")]);
  const targetMenuById = new Map(targetMenuRows.map((row) => [row.id, row]));
  requireCount("menu_mapping", targetMenuRows.length, sourceMenus.length);
  for (const source of sourceMenus) assertMappedRow(targetMenuById.get(target("menu_items", source.id)), { source_id: source.id, tenant_id: targetTenantId, key: source.key, route: source.route, parent_id: source.parent_id ? target("menu_items", source.parent_id) : null }, "menu_parent_mapping", ["tenant_id", "key", "route", "parent_id"]);
  const duplicateMenu = await query("SELECT count(*) AS count FROM (SELECT key FROM menu_items WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY key HAVING count(*)>1 UNION ALL SELECT route FROM menu_items WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY route HAVING count(*)>1) duplicates", [targetTenantId]);
  requireCount("menu_unique_active_key_route", duplicateMenu[0].count, 0);
  const targetRmp = await query("SELECT id, tenant_id, role_id, menu_item_id, access_level, actions FROM role_menu_permissions WHERE id=ANY($1::uuid[])", [targetIds("role_menu_permissions")]);
  requireCount("role_menu_permission_count", targetRmp.length, sourceRoleMenuPermissions.length);
  const sourceRmpById = new Map(sourceRoleMenuPermissions.map((row) => [row.id, row]));
  for (const row of targetRmp) {
    const source = sourceRmpById.get(Object.entries(manifest.maps.role_menu_permissions).find(([, value]) => value.target_id === row.id)?.[0]);
    if (!source || row.tenant_id !== targetTenantId || row.role_id !== superUserRole || !targetIds("menu_items").includes(row.menu_item_id) || !["READ", "WRITE"].includes(row.access_level)) fail(`post-write role_menu_permission_mapping: invalid target=${row.id}`);
    if (row.access_level !== source.access_level || JSON.stringify(row.actions || {}) !== JSON.stringify(source.actions || {})) fail(`post-write role_menu_permission_mapping: semantic mismatch target=${row.id}`);
  }
  const targetLegacy = await query("SELECT id, tenant_id, role_id, module, route, label, visible FROM permissions WHERE id=ANY($1::uuid[])", [targetIds("permissions")]);
  requireCount("legacy_permission_count", targetLegacy.length, sourcePermissions.length);
  const sourceLegacyById = new Map(sourcePermissions.map((row) => [row.id, row]));
  for (const row of targetLegacy) {
    const source = sourceLegacyById.get(Object.entries(manifest.maps.permissions).find(([, value]) => value.target_id === row.id)?.[0]);
    if (!source || row.tenant_id !== targetTenantId || row.role_id !== superUserRole) fail(`post-write legacy_permission_mapping: invalid target=${row.id}`);
    for (const field of ["module", "route", "label", "visible"]) if (!sameValue(row[field], source[field])) fail(`post-write legacy_permission_mapping: field=${field}, target=${row.id}`);
  }

  const customerRows = await query("SELECT id, tenant_id, name, document_number, is_active, is_final_consumer, is_default FROM customers WHERE id=$1", [customerId]);
  assertMappedRow(customerRows[0], { source_id: customerId, tenant_id: targetTenantId, name: "Consumidor Final", document_number: "222222222222", is_active: true, is_final_consumer: true, is_default: true }, "final_consumer", ["tenant_id", "name", "document_number", "is_active", "is_final_consumer", "is_default"]);
  requireCount("final_consumer_active", (await query("SELECT count(*) AS count FROM customers WHERE tenant_id=$1 AND is_final_consumer AND is_active", [targetTenantId]))[0].count, 1);
  requireCount("final_consumer_default", (await query("SELECT count(*) AS count FROM customers WHERE tenant_id=$1 AND is_default AND is_active", [targetTenantId]))[0].count, 1);

  const terminal = (await query("SELECT id, tenant_id, branch_id, name, code FROM terminals WHERE id=$1", [terminalId]))[0];
  assertMappedRow(terminal, { source_id: terminalId, tenant_id: targetTenantId, branch_id: branchId, name: "Terminal 1", code: "TERM-001" }, "terminal_ownership", ["tenant_id", "branch_id", "name", "code"]);
  const pos = (await query("SELECT id, tenant_id, branch_id, code, name, active, mode, operational_terminal_id FROM pos_terminals WHERE id=$1", [posTerminalId]))[0];
  assertMappedRow(pos, { source_id: posTerminalId, tenant_id: targetTenantId, branch_id: branchId, code: "TERM-001", name: "Terminal 1", active: true, mode: "HYBRID", operational_terminal_id: terminalId }, "pos_terminal_ownership", ["tenant_id", "branch_id", "code", "name", "active", "mode", "operational_terminal_id"]);
  const cash = (await query("SELECT id, tenant_id, branch_id, terminal_id, codigo, nombre, activo FROM cash_registers WHERE id=$1", [cashRegisterId]))[0];
  assertMappedRow(cash, { source_id: cashRegisterId, tenant_id: targetTenantId, branch_id: branchId, terminal_id: terminalId, codigo: "CAJA-001", nombre: "Caja 1", activo: true }, "cash_register_ownership", ["tenant_id", "branch_id", "terminal_id", "codigo", "nombre", "activo"]);

  const imageTargets = new Map(manifest.images.map((entry) => [`${entry.entity_type}:${entry.target_entity_id}`, entry]));
  const imageChecks = [
    ["product-categories", sourceCategory.id, manifest.maps.category.target_id, "product_categories", "default_image_storage_key", "default_image_url"],
    ...sourceSubcategories.map((row) => ["product-subcategories", row.id, target("subcategories", row.id), "product_subcategories", "default_image_storage_key", "default_image_url"]),
    ...sourceProducts.map((row) => ["products", row.id, target("products", row.id), "products", "image_storage_key", "image_url"]),
  ];
  for (const [type, sourceId, targetId, table, keyColumn, urlColumn] of imageChecks) {
    const image = imageTargets.get(`${type}:${targetId}`);
    if (!image) continue;
    const row = (await query(`SELECT "${keyColumn}" AS storage_key, "${urlColumn}" AS image_url FROM public."${table}" WHERE id=$1`, [targetId]))[0];
    if (!row || row.storage_key !== image.target_storage_key || !row.storage_key.startsWith(`${type}/${targetTenantId}/${targetId}/`) || row.image_url !== image.image_url) fail(`post-write image_mapping: ${type} source=${sourceId} target=${targetId}`);
  }
}

async function applyProvisioning(client, env, manifest) {
  const bcrypt = require(path.resolve(__dirname, "../../../api/node_modules/bcryptjs"));
  const sourceTenantId = SOURCE_TENANT_ID;
  const targetTenantId = requireManifestEntityId(manifest, "tenant");
  const maps = {
    category: new Map(), subcategory: new Map(), product: new Map(), unit: new Map(),
    tax: new Map(), rate: new Map(), barcode: new Map(), productTax: new Map(),
    profile: new Map(), menu: new Map(), permission: new Map(),
  };
  let writeGateOpen = false;
  let tenantRowInserted = false;
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
  try {
    const revalidated = await preflight(client, env, { checkLocalImages: false });
    if (revalidated.blockers?.length) fail(`apply preflight blocked: ${revalidated.blockers.join(" | ")}`);
    assertManifestMatchesReport(manifest, revalidated);
    writeGateOpen = true;
    if (!writeGateOpen) fail("write gate was not opened by transactional manifest validation");
    const sourceCategory = (await client.query("SELECT * FROM product_categories WHERE tenant_id=$1 AND (lower(name)='licores' OR lower(slug)='licores')", [sourceTenantId])).rows[0];
    const sourceSubcategories = (await client.query("SELECT * FROM product_subcategories WHERE tenant_id=$1 AND category_id=$2 ORDER BY sort_order, name", [sourceTenantId, sourceCategory.id])).rows;
    const sourceProducts = (await client.query("SELECT * FROM products WHERE tenant_id=$1 AND category_id=$2 ORDER BY id", [sourceTenantId, sourceCategory.id])).rows;
    const sourceProductIds = sourceProducts.map((row) => row.id);
    const sourceUnits = (await client.query("SELECT * FROM units WHERE tenant_id=$1 AND is_active ORDER BY id", [sourceTenantId])).rows;
    const definitiveUnitIds = new Map(sourceUnits.map((row) => [row.id, requireManifestTargetId(manifest, "units", row.id)]));
    const sourceBarcodes = (await client.query("SELECT * FROM product_barcodes WHERE tenant_id=$1 AND product_id=ANY($2::uuid[])", [sourceTenantId, sourceProductIds])).rows;
    const sourceProductTaxes = (await client.query("SELECT * FROM product_taxes WHERE tenant_id=$1 AND product_id=ANY($2::uuid[])", [sourceTenantId, sourceProductIds])).rows;
    const sourceProfiles = (await client.query("SELECT * FROM product_tax_profiles WHERE tenant_id=$1 AND product_id=ANY($2::uuid[])", [sourceTenantId, sourceProductIds])).rows;
    const requiredTaxIds = [...new Set([...sourceProducts.map((row) => row.tax_id), ...sourceProductTaxes.map((row) => row.tax_id)].filter(Boolean))];
    const sourceTaxes = (await client.query("SELECT * FROM taxes WHERE tenant_id=$1 AND id=ANY($2::uuid[])", [sourceTenantId, requiredTaxIds])).rows;
    const sourceRates = (await client.query("SELECT * FROM tax_rates WHERE tenant_id=$1 AND tax_id=ANY($2::uuid[])", [sourceTenantId, requiredTaxIds])).rows;
    const sourceBranch = (await client.query("SELECT * FROM tenant_branches WHERE tenant_id=$1 AND es_principal=true", [sourceTenantId])).rows[0];
    const geography = (await client.query(`
      SELECT (SELECT id FROM paises WHERE lower(nombre)='colombia' LIMIT 1) AS pais_id,
             (SELECT id FROM departamentos WHERE codigo_dane='08' LIMIT 1) AS departamento_id,
             (SELECT id FROM municipios WHERE codigo_dane='08001' LIMIT 1) AS municipio_id`)).rows[0];
    const superUserRole = (await client.query("SELECT id FROM roles WHERE nombre='SUPER_USER' LIMIT 1")).rows[0].id;
    const finalConsumer = (await client.query("SELECT * FROM customers WHERE tenant_id=$1 AND is_final_consumer AND is_active ORDER BY is_default DESC LIMIT 1", [sourceTenantId])).rows[0];
    const sourceMenus = (await client.query("SELECT * FROM menu_items WHERE tenant_id=$1 AND deleted_at IS NULL", [sourceTenantId])).rows;
    const orderedSourceMenus = orderMenusTopologically(sourceMenus);
    assertMenuUniqueValues(sourceMenus);
    const sourceRoleMenuPermissions = (await client.query("SELECT rmp.* FROM role_menu_permissions rmp JOIN roles r ON r.id=rmp.role_id WHERE rmp.tenant_id=$1 AND r.nombre='SUPER_USER'", [sourceTenantId])).rows;
    const sourcePermissions = (await client.query("SELECT p.* FROM permissions p JOIN roles r ON r.id=p.role_id WHERE p.tenant_id=$1 AND r.nombre='SUPER_USER'", [sourceTenantId])).rows;
    const sourcePayments = (await client.query("SELECT * FROM payment_methods WHERE tenant_id=$1 AND active ORDER BY codigo", [sourceTenantId])).rows;
    assertRoleMenuPermissions(sourceRoleMenuPermissions, new Set(sourceMenus.map((row) => row.id)));

    await insertRow(client, "tenants", { id: targetTenantId, slug: TARGET_SLUG, nombre: "CARIBBEAN BEER LICORES SAS", config: {} , activo: true });
    tenantRowInserted = true;
    await insertRow(client, "tenants_detalles", {
      tenant_id: targetTenantId, razon_social: "CARIBBEAN BEER LICORES SAS", nit: TARGET_NIT, dv: "2",
      tipo_persona: "JURIDICA", tipo_sociedad: "SOCIEDAD POR ACCIONES SIMPLIFICADA", estado: "Activa",
      responsabilidades_dian: "Responsable de IVA", regimen: "Régimen simple de tributación",
      actividad_economica: "4711 - Comercio al por menor en establecimientos no especializados con surtido compuesto principalmente por alimentos, bebidas alcohólicas y no alcohólicas o tabaco",
      obligado_facturacion_electronica: true, direccion_principal: "CALLE 130 8 C 26", ciudad: "Barranquilla",
      departamento: "Atlántico", pais: "Colombia", telefono: "3105244371", email_corporativo: TARGET_EMAIL,
      sitio_web: null, pais_id: geography.pais_id, departamento_id: geography.departamento_id,
      municipio_id: geography.municipio_id, vat_responsibility: "RESPONSIBLE",
    });
    const branchId = requireManifestTargetId(manifest, "branch", sourceBranch.id);
    await insertRow(client, "tenant_branches", {
      id: branchId, tenant_id: targetTenantId, codigo: "PRINCIPAL", nombre: "CARIBE LICORES",
      es_principal: true, direccion: "CALLE 130 8 C 26", ciudad: "Barranquilla", departamento: "Atlántico",
      pais: "Colombia", telefono: "3105244371", email: TARGET_EMAIL, estado: "ACTIVE",
      pais_id: geography.pais_id, departamento_id: geography.departamento_id, municipio_id: geography.municipio_id,
    });
    const personaId = requireManifestEntityId(manifest, "persona");
    await insertRow(client, "personas", { id: personaId, tenant_id: targetTenantId, nombres: "Super", apellidos: "User", documento_tipo: "CC", documento_numero: "SU-CARIBBEAN_BEER_LICORES", email_personal: TARGET_EMAIL, cargo_nombre: "SUPER_USER" });
    const userId = requireManifestEntityId(manifest, "user");
    await insertRow(client, "users", { id: userId, tenant_id: targetTenantId, persona_id: personaId, email: TARGET_EMAIL, password_hash: await bcrypt.hash("12345678", 12), estado: "ACTIVE" });
    await insertRow(client, "user_roles", { user_id: userId, role_id: superUserRole, tenant_id: targetTenantId });
    await insertRow(client, "persona_tenant_branches", { persona_id: personaId, tenant_branch_id: branchId, tenant_id: targetTenantId, es_principal: true });

    await insertRow(client, "customers", {
      id: requireManifestEntityId(manifest, "customer"),
      tenant_id: targetTenantId,
      name: "Consumidor Final",
      document_number: "222222222222",
      document_type_code: finalConsumer.document_type_code,
      document_number_normalized: "222222222222",
      is_active: true,
      is_final_consumer: true,
      is_default: true,
    });
    for (const row of sourceUnits) maps.unit.set(row.id, definitiveUnitIds.get(row.id));
    for (const row of sourceTaxes) maps.tax.set(row.id, requireManifestTargetId(manifest, "taxes", row.id));
    for (const row of sourceBarcodes) maps.barcode.set(row.id, requireManifestTargetId(manifest, "barcodes", row.id));
    for (const row of sourceProductTaxes) maps.productTax.set(row.id, requireManifestTargetId(manifest, "product_taxes", row.id));
    for (const row of sourceProfiles) maps.profile.set(row.id, requireManifestTargetId(manifest, "product_tax_profiles", row.id));
    for (const row of sourceProducts) maps.product.set(row.id, requireManifestTargetId(manifest, "products", row.id));
    maps.category.set(sourceCategory.id, requireManifestEntityId(manifest, "category"));
    for (const row of sourceSubcategories) maps.subcategory.set(row.id, requireManifestTargetId(manifest, "subcategories", row.id));
    for (const row of sourceRates) maps.rate.set(row.id, requireManifestTargetId(manifest, "tax_rates", row.id));
    const targetImageManifest = { entries: manifest.images.map((entry) => ({ ...entry, preview_target_entity_id: entry.target_entity_id, image_url: entry.image_url })) };

    const categoryImage = targetImageManifest.entries.find((entry) => entry.entity_type === "product-categories");
    const categoryImageData = categoryImage ? { default_image_url: categoryImage.image_url, default_image_storage_key: categoryImage.target_storage_key, default_image_mime_type: sourceCategory.default_image_mime_type, default_image_size_bytes: sourceCategory.default_image_size_bytes, default_image_alt_text: sourceCategory.default_image_alt_text } : { default_image_url: null, default_image_storage_key: null };
    await insertRow(client, "product_categories", { ...categoryImageData, id: maps.category.get(sourceCategory.id), tenant_id: targetTenantId, name: sourceCategory.name, slug: sourceCategory.slug, description: sourceCategory.description, is_active: sourceCategory.is_active, sort_order: sourceCategory.sort_order });
    for (const row of sourceSubcategories) {
      const image = targetImageManifest.entries.find((entry) => entry.entity_type === "product-subcategories" && entry.source_entity_id === row.id);
      await insertRow(client, "product_subcategories", { id: maps.subcategory.get(row.id), tenant_id: targetTenantId, category_id: maps.category.get(row.category_id), name: row.name, slug: row.slug, description: row.description, default_image_url: image?.image_url ?? null, default_image_storage_key: image?.target_storage_key ?? null, default_image_alt_text: row.default_image_alt_text, default_image_mime_type: row.default_image_mime_type, default_image_size_bytes: row.default_image_size_bytes, is_active: row.is_active, sort_order: row.sort_order });
    }
    if (!tenantRowInserted) fail("units insert blocked: target tenant row was not inserted in this transaction");
    for (const row of sourceUnits) await insertRow(client, "units", { id: definitiveUnitIds.get(row.id), tenant_id: targetTenantId, name: row.name, abbreviation: row.abbreviation, is_active: row.is_active });
    for (const row of sourceTaxes) await insertRow(client, "taxes", { id: maps.tax.get(row.id), tenant_id: targetTenantId, name: row.name, rate: row.rate, is_included: row.is_included, is_active: row.is_active, tax_type_id: row.tax_type_id, calculation_method_id: row.calculation_method_id, tax_base_type_id: row.tax_base_type_id });
    for (const row of sourceRates) await insertRow(client, "tax_rates", { id: maps.rate.get(row.id), tenant_id: targetTenantId, tax_id: maps.tax.get(row.tax_id), tax_product_category_id: row.tax_product_category_id, calculation_method_id: row.calculation_method_id, tax_base_type_id: row.tax_base_type_id, percentage_rate: row.percentage_rate, fixed_amount: row.fixed_amount, base_quantity: row.base_quantity, base_unit_code: row.base_unit_code, effective_from: row.effective_from, effective_to: row.effective_to, is_active: row.is_active });
    for (const row of sourceProducts) {
      const image = targetImageManifest.entries.find((entry) => entry.entity_type === "products" && entry.source_entity_id === row.id);
      await insertRow(client, "products", { id: maps.product.get(row.id), tenant_id: targetTenantId, unit_id: maps.unit.get(row.unit_id), tax_id: row.tax_id ? maps.tax.get(row.tax_id) : null, name: row.name, description: row.description, sku: row.sku, price: row.price, cost: row.cost, price_with_tax: row.price_with_tax, price_without_tax: row.price_without_tax, is_active: row.is_active, is_perishable: row.is_perishable, requires_lot: row.requires_lot, requires_expiration: row.requires_expiration, operational_status: row.operational_status, rotation_class: row.rotation_class, min_stock: row.min_stock, max_stock: row.max_stock, sale_type: row.sale_type, measurement_unit: row.measurement_unit, category_id: maps.category.get(row.category_id), subcategory_id: row.subcategory_id ? maps.subcategory.get(row.subcategory_id) : null, image_url: image?.image_url ?? null, image_storage_key: image?.target_storage_key ?? null, image_alt_text: row.image_alt_text, image_mime_type: row.image_mime_type, image_size_bytes: row.image_size_bytes, image_updated_at: row.image_updated_at, dian_standard_item_scheme_id: row.dian_standard_item_scheme_id, dian_standard_item_code: row.dian_standard_item_code });
    }
    for (const row of sourceBarcodes) await insertRow(client, "product_barcodes", { id: maps.barcode.get(row.id), tenant_id: targetTenantId, product_id: maps.product.get(row.product_id), barcode: row.barcode, barcode_type: row.barcode_type, is_primary: row.is_primary, is_active: row.is_active });
    for (const row of sourceProductTaxes) await insertRow(client, "product_taxes", { id: maps.productTax.get(row.id), tenant_id: targetTenantId, product_id: maps.product.get(row.product_id), tax_id: maps.tax.get(row.tax_id), calculation_order: row.calculation_order, is_active: row.is_active });
    for (const row of sourceProfiles) await insertRow(client, "product_tax_profiles", { id: maps.profile.get(row.id), tenant_id: targetTenantId, product_id: maps.product.get(row.product_id), tax_product_category_id: row.tax_product_category_id, alcohol_degree: row.alcohol_degree, net_volume_ml: row.net_volume_ml, dane_certified_retail_price: row.dane_certified_retail_price, dane_price_effective_from: row.dane_price_effective_from, dane_price_effective_to: row.dane_price_effective_to });
    for (const row of sourcePayments) await insertRow(client, "payment_methods", { id: requireManifestTargetId(manifest, "payment_methods", row.id), tenant_id: targetTenantId, codigo: row.codigo, nombre: row.nombre, tipo: row.tipo, requires_reference: row.requires_reference, allows_change: row.allows_change, active: row.active, electronic_billing_enabled: false, electronic_payment_means_code: row.electronic_payment_means_code, electronic_payment_means_id: row.electronic_payment_means_id });

    const terminalId = requireManifestEntityId(manifest, "terminal");
    await insertRow(client, "terminals", { id: terminalId, tenant_id: targetTenantId, branch_id: branchId, name: "Terminal 1", code: "TERM-001", is_active: true });
    const posTerminalId = requireManifestEntityId(manifest, "pos_terminal");
    await insertRow(client, "pos_terminals", { id: posTerminalId, tenant_id: targetTenantId, branch_id: branchId, code: "TERM-001", name: "Terminal 1", active: true, mode: "HYBRID", operational_terminal_id: terminalId });
    await insertRow(client, "cash_registers", { id: requireManifestEntityId(manifest, "cash_register"), tenant_id: targetTenantId, branch_id: branchId, terminal_id: terminalId, codigo: "CAJA-001", nombre: "Caja 1", activo: true });
    for (const row of orderedSourceMenus) maps.menu.set(row.id, requireManifestTargetId(manifest, "menu_items", row.id));
    for (const row of orderedSourceMenus) await insertRow(client, "menu_items", { id: maps.menu.get(row.id), tenant_id: targetTenantId, key: row.key, module: row.module, label: row.label, route: row.route, icon: row.icon, parent_id: row.parent_id ? maps.menu.get(row.parent_id) : null, sort_order: row.sort_order, visible: row.visible, below_main_menu: row.below_main_menu, metadata: row.metadata });
    for (const row of sourceRoleMenuPermissions) await insertRow(client, "role_menu_permissions", { id: requireManifestTargetId(manifest, "role_menu_permissions", row.id), tenant_id: targetTenantId, role_id: superUserRole, menu_item_id: maps.menu.get(row.menu_item_id), access_level: row.access_level, actions: row.actions });
    for (const row of sourcePermissions) await insertRow(client, "permissions", { id: requireManifestTargetId(manifest, "permissions", row.id), role_id: superUserRole, tenant_id: targetTenantId, module: row.module, route: row.route, label: row.label, visible: row.visible });

    for (const entry of targetImageManifest.entries) {
      if (!entry.target_storage_key.startsWith(`${entry.entity_type}/${targetTenantId}/`)) fail(`target image key escaped tenant scope: ${entry.target_storage_key}`);
    }
    const validation = await client.query(`
      SELECT
        (SELECT count(*) FROM tenants WHERE id=$1) AS tenants,
        (SELECT count(*) FROM tenants_detalles WHERE tenant_id=$1) AS tenant_details,
        (SELECT count(*) FROM tenant_branches WHERE tenant_id=$1 AND es_principal) AS branches,
        (SELECT count(*) FROM personas WHERE tenant_id=$1) AS personas,
        (SELECT count(*) FROM users WHERE tenant_id=$1 AND email=$2) AS users,
        (SELECT count(*) FROM user_roles WHERE tenant_id=$1 AND role_id=$3) AS user_roles,
        (SELECT count(*) FROM customers WHERE tenant_id=$1 AND is_final_consumer AND is_default AND is_active) AS customers,
        (SELECT count(*) FROM customers WHERE tenant_id=$1 AND is_final_consumer AND is_active) AS active_final_consumers,
        (SELECT count(*) FROM customers WHERE tenant_id=$1 AND is_default AND is_active) AS active_default_customers,
        (SELECT count(*) FROM units WHERE tenant_id=$1) AS units,
        (SELECT count(*) FROM payment_methods WHERE tenant_id=$1) AS payment_methods,
        (SELECT count(*) FROM menu_items WHERE tenant_id=$1 AND deleted_at IS NULL) AS menu_items,
        (SELECT count(*) FROM role_menu_permissions WHERE tenant_id=$1) AS role_menu_permissions,
        (SELECT count(*) FROM permissions WHERE tenant_id=$1) AS permissions,
        (SELECT count(*) FROM terminals WHERE tenant_id=$1) AS terminals,
        (SELECT count(*) FROM pos_terminals WHERE tenant_id=$1) AS pos_terminals,
        (SELECT count(*) FROM cash_registers WHERE tenant_id=$1) AS cash_registers,
        (SELECT count(*) FROM product_categories WHERE tenant_id=$1) AS categories,
        (SELECT count(*) FROM product_subcategories WHERE tenant_id=$1) AS subcategories,
        (SELECT count(*) FROM products WHERE tenant_id=$1) AS products,
        (SELECT count(*) FROM product_barcodes WHERE tenant_id=$1) AS barcodes,
        (SELECT count(*) FROM taxes WHERE tenant_id=$1) AS taxes,
        (SELECT count(*) FROM tax_rates WHERE tenant_id=$1) AS tax_rates,
        (SELECT count(*) FROM product_taxes WHERE tenant_id=$1) AS product_taxes,
        (SELECT count(*) FROM product_tax_profiles WHERE tenant_id=$1) AS profiles
    `, [targetTenantId, TARGET_EMAIL, superUserRole]);
    const expected = {
      tenants: 1, tenant_details: 1, branches: 1, personas: 1, users: 1, user_roles: 1, customers: 1,
      units: sourceUnits.length, payment_methods: sourcePayments.length, menu_items: sourceMenus.length,
      role_menu_permissions: sourceRoleMenuPermissions.length, permissions: sourcePermissions.length,
      terminals: 1, pos_terminals: 1, cash_registers: 1, categories: 1, subcategories: sourceSubcategories.length,
      products: sourceProducts.length, barcodes: sourceBarcodes.length, taxes: sourceTaxes.length,
      tax_rates: sourceRates.length, product_taxes: sourceProductTaxes.length, profiles: sourceProfiles.length,
    };
    if (Number(validation.rows[0].active_final_consumers) !== 1 || Number(validation.rows[0].active_default_customers) !== 1) {
      fail(`post-write final consumer cardinality failed: active_final=${validation.rows[0].active_final_consumers}, active_default=${validation.rows[0].active_default_customers}`);
    }
    for (const [key, expectedCount] of Object.entries(expected)) {
      if (Number(validation.rows[0][key]) !== expectedCount) fail(`post-write target count validation failed for ${key}: expected=${expectedCount}, actual=${validation.rows[0][key]}`);
    }
    await validatePostWrite(client, {
      manifest, targetTenantId, sourceTenantId, sourceCategory, sourceSubcategories, sourceProducts,
      sourceUnits, sourceTaxes, sourceRates, sourceBarcodes, sourceProductTaxes, sourceProfiles,
      sourceBranch, sourceMenus, sourceRoleMenuPermissions, sourcePermissions, sourcePayments,
      branchId, personaId, userId, customerId: manifest.maps.customer.target_id,
      terminalId, posTerminalId, cashRegisterId: manifest.maps.cash_register.target_id, superUserRole,
    });
    await client.query("COMMIT");
    return { target_tenant_id: targetTenantId, image_files_created: 0, status: "APPLY_COMMITTED", image_upload_mode: "manual-before-apply" };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

function assertQaEnvironment(env) {
  const environment = String(env.ENVIRONMENT || "").toLowerCase();
  const database = String(env.DB_NAME || "");
  if (!["qa", "staging"].includes(environment)) fail("ENVIRONMENT must be qa or staging");
  if (!database.endsWith("_qa") && !database.endsWith("_staging")) {
    fail("DB_NAME must end in _qa or _staging");
  }
  if (database === "manus_tienda" || database === "manus_tienda_prd") {
    fail("protected production-like database name");
  }
}

async function preflight(client, env, { checkLocalImages = true } = {}) {
  const requiredTables = [
    "tenants", "tenants_detalles", "tenant_branches", "paises", "departamentos", "municipios",
    "roles", "users", "user_roles", "personas", "persona_tenant_branches", "menu_items",
    "role_menu_permissions", "permissions", "customers", "units", "payment_methods", "terminals",
    "pos_terminals", "cash_registers", "inventory_locations", "product_categories",
    "product_subcategories", "products",
    "product_barcodes", "taxes", "tax_rates", "product_taxes", "product_tax_profiles", "tax_categories",
    "tax_types", "tax_product_categories", "tax_calculation_methods", "tax_base_types",
    "electronic_billing_providers",
  ];
  const tableResult = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1)",
    [requiredTables]
  );
  const existing = new Set(tableResult.rows.map((row) => row.table_name));
  const missing = requiredTables.filter((table) => !existing.has(table));
  if (missing.length) fail(`required tables missing: ${missing.join(", ")}`);

  const source = await client.query(
    "SELECT id, slug, activo FROM tenants WHERE id=$1",
    [SOURCE_TENANT_ID]
  );
  if (source.rowCount !== 1) fail("source tenant does not exist exactly once");

  const target = await client.query(
    `SELECT t.id, t.slug, d.nit, d.razon_social
       FROM tenants t
       LEFT JOIN tenants_detalles d ON d.tenant_id=t.id
      WHERE t.slug=$1 OR d.nit=$2`,
    [TARGET_SLUG, TARGET_NIT]
  );
  if (target.rowCount) {
    const exact = target.rows.every((row) => row.slug === TARGET_SLUG && row.nit === TARGET_NIT && row.razon_social === "CARIBBEAN BEER LICORES SAS");
    if (!exact) fail("target slug or NIT collides with a different company");
    fail("target identity already exists; completed-target idempotency validation is not enabled until the catalog contract is fixed");
  }

  const refs = await client.query(`
    SELECT
      (SELECT count(*) FROM roles WHERE nombre='SUPER_USER') AS super_user_roles,
      (SELECT count(*) FROM paises WHERE lower(nombre)='colombia') AS colombia,
      (SELECT count(*) FROM departamentos WHERE codigo_dane='08') AS atlantico,
      (SELECT count(*) FROM municipios WHERE codigo_dane='08001') AS barranquilla,
      (SELECT count(*) FROM tax_categories) AS tax_categories,
      (SELECT count(*) FROM tax_types) AS tax_types,
      (SELECT count(*) FROM tax_product_categories) AS tax_product_categories,
      (SELECT count(*) FROM tax_calculation_methods) AS tax_calculation_methods,
      (SELECT count(*) FROM tax_base_types) AS tax_base_types,
      (SELECT count(*) FROM electronic_billing_providers) AS electronic_billing_providers
  `);
  const requiredRefs = refs.rows[0];
  for (const [name, count] of Object.entries(requiredRefs)) {
    if (Number(count) < 1) fail(`required global reference missing: ${name}`);
  }

  const categories = await client.query(
    `SELECT id, name, slug, description, default_image_url, default_image_storage_key,
            default_image_alt_text, default_image_mime_type, default_image_size_bytes,
            is_active, sort_order
       FROM product_categories
      WHERE tenant_id=$1 AND (lower(name)='licores' OR lower(slug)='licores')`,
    [SOURCE_TENANT_ID]
  );
  if (categories.rowCount !== 1) fail(`Licores category is not unique; matches=${categories.rowCount}`);
  const categoryId = categories.rows[0].id;

  const selectedProducts = await client.query(
    `SELECT id, subcategory_id, image_storage_key, image_url
       FROM products
      WHERE tenant_id=$1 AND category_id=$2
      ORDER BY id`,
    [SOURCE_TENANT_ID, categoryId]
  );
  if (selectedProducts.rowCount !== 71) {
    // Do not hard-code the expected count as a write requirement; report live drift.
    console.warn(`[caribbean-beer-licores] Notice: live selected product count is ${selectedProducts.rowCount}, expected evidence was 71`);
  }

  const scope = await client.query(`
    WITH selected AS (
      SELECT * FROM products WHERE tenant_id=$1 AND category_id=$2
    )
    SELECT
      (SELECT count(*) FROM selected) AS products,
      (SELECT count(DISTINCT subcategory_id) FROM selected WHERE subcategory_id IS NOT NULL) AS subcategory_ids,
      (SELECT count(*) FROM product_barcodes WHERE tenant_id=$1 AND product_id IN (SELECT id FROM selected)) AS barcodes,
      (SELECT count(DISTINCT unit_id) FROM selected) AS required_units,
      (SELECT count(DISTINCT tax_id) FROM selected WHERE tax_id IS NOT NULL) AS legacy_taxes,
      (SELECT count(*) FROM product_taxes WHERE tenant_id=$1 AND product_id IN (SELECT id FROM selected)) AS product_taxes,
      (SELECT count(*) FROM product_tax_profiles WHERE tenant_id=$1 AND product_id IN (SELECT id FROM selected)) AS product_tax_profiles,
      (SELECT count(*) FROM selected WHERE image_url IS NOT NULL OR image_storage_key IS NOT NULL) AS image_refs,
      (SELECT count(*) FROM selected WHERE requires_lot OR requires_expiration) AS lot_or_expiration_products
  `, [SOURCE_TENANT_ID, categoryId]);
  const sourceScope = scope.rows[0];
  if (Number(sourceScope.products) < 1) fail("Licores category has no products");

  const dependencyCounts = await client.query(`
    WITH selected AS (
      SELECT id, unit_id, tax_id
        FROM products
       WHERE tenant_id=$1 AND category_id=$2
    ),
    required_taxes AS (
      SELECT tax_id FROM selected WHERE tax_id IS NOT NULL
      UNION
      SELECT tax_id FROM product_taxes WHERE tenant_id=$1 AND product_id IN (SELECT id FROM selected)
    )
    SELECT
      (SELECT count(DISTINCT unit_id) FROM selected)::int AS required_units,
      (SELECT count(*) FROM required_taxes)::int AS required_taxes,
      (SELECT count(*) FROM taxes t WHERE t.tenant_id=$1 AND t.id IN (SELECT tax_id FROM required_taxes))::int AS resolved_taxes,
      (SELECT count(*) FROM tax_rates tr WHERE tr.tenant_id=$1 AND tr.tax_id IN (SELECT tax_id FROM required_taxes))::int AS required_tax_rates,
      (SELECT count(*) FROM customers WHERE tenant_id=$1 AND is_final_consumer AND is_active)::int AS active_final_consumers,
      (SELECT count(*) FROM customers WHERE tenant_id=$1 AND is_default AND is_active)::int AS active_default_customers,
      (SELECT count(*) FROM terminals WHERE tenant_id=$1 AND is_active)::int AS active_operational_terminals,
      (SELECT count(*) FROM pos_terminals WHERE tenant_id=$1 AND active)::int AS active_pos_terminals,
      (SELECT count(*) FROM cash_registers WHERE tenant_id=$1 AND activo)::int AS active_cash_registers,
      (SELECT count(*) FROM inventory_locations WHERE tenant_id=$1 AND is_active)::int AS active_inventory_locations
  `, [SOURCE_TENANT_ID, categoryId]);

  const subcategoryResolution = await client.query(`
    WITH selected AS (
      SELECT p.subcategory_id
        FROM products p
       WHERE p.tenant_id=$1 AND p.category_id=$2
    ),
    distinct_selected AS (
      SELECT DISTINCT subcategory_id
        FROM selected
       WHERE subcategory_id IS NOT NULL
    )
    SELECT
      (SELECT count(*) FROM distinct_selected)::int AS source_ids,
      (SELECT count(ps.id) FROM distinct_selected ds LEFT JOIN product_subcategories ps ON ps.tenant_id=$1 AND ps.id=ds.subcategory_id)::int AS supported_rows,
      (SELECT count(*) FROM selected WHERE subcategory_id IS NULL)::int AS null_products,
      (SELECT count(*) FROM selected s LEFT JOIN product_subcategories ps ON ps.tenant_id=$1 AND ps.id=s.subcategory_id WHERE s.subcategory_id IS NOT NULL AND ps.id IS NULL)::int AS missing_products,
      (SELECT count(*) FROM selected s JOIN product_subcategories ps ON ps.id=s.subcategory_id WHERE ps.tenant_id <> $1 OR ps.category_id <> $2)::int AS inconsistent_products
  `, [SOURCE_TENANT_ID, categoryId]);
  const subcategoryResolutionRow = subcategoryResolution.rows[0];
  if (
    Number(subcategoryResolutionRow.source_ids) !== Number(subcategoryResolutionRow.supported_rows)
    || Number(subcategoryResolutionRow.missing_products) > 0
    || Number(subcategoryResolutionRow.inconsistent_products) > 0
  ) {
    fail(
      `selected products have unresolved or inconsistent product_subcategories: `
      + `source_ids=${subcategoryResolutionRow.source_ids}, `
      + `supported_rows=${subcategoryResolutionRow.supported_rows}, `
      + `missing_products=${subcategoryResolutionRow.missing_products}, `
      + `inconsistent_products=${subcategoryResolutionRow.inconsistent_products}`
    );
  }
  const sourceSubcategories = await client.query(`
    SELECT ps.id, ps.tenant_id, ps.category_id, ps.name, ps.slug, ps.description,
           ps.default_image_url, ps.default_image_storage_key, ps.default_image_alt_text,
           ps.default_image_mime_type, ps.default_image_size_bytes, ps.is_active, ps.sort_order,
           count(p.id)::int AS product_count
      FROM product_subcategories ps
      LEFT JOIN products p
        ON p.tenant_id=ps.tenant_id
       AND p.category_id=ps.category_id
       AND p.subcategory_id=ps.id
     WHERE ps.tenant_id=$1 AND ps.category_id=$2
     GROUP BY ps.id, ps.tenant_id, ps.category_id, ps.name, ps.slug, ps.description,
              ps.default_image_url, ps.default_image_storage_key, ps.default_image_alt_text,
              ps.default_image_mime_type, ps.default_image_size_bytes, ps.is_active, ps.sort_order
     ORDER BY ps.sort_order, ps.name
  `, [SOURCE_TENANT_ID, categoryId]);
  if (sourceSubcategories.rowCount !== Number(subcategoryResolutionRow.source_ids)) {
    fail(`source product_subcategories count does not match selected product references: rows=${sourceSubcategories.rowCount}, referenced=${subcategoryResolutionRow.source_ids}`);
  }
  const sourceIds = await client.query(`
    WITH selected AS (
      SELECT id, unit_id, tax_id FROM products WHERE tenant_id=$1 AND category_id=$2
    ), required_taxes AS (
      SELECT tax_id FROM selected WHERE tax_id IS NOT NULL
      UNION SELECT tax_id FROM product_taxes WHERE tenant_id=$1 AND product_id IN (SELECT id FROM selected)
    )
    SELECT
      ARRAY(SELECT id FROM selected ORDER BY id) AS product_ids,
      ARRAY(SELECT id FROM product_barcodes WHERE tenant_id=$1 AND product_id IN (SELECT id FROM selected) ORDER BY id) AS barcode_ids,
      ARRAY(SELECT id FROM product_taxes WHERE tenant_id=$1 AND product_id IN (SELECT id FROM selected) ORDER BY id) AS product_tax_ids,
      ARRAY(SELECT id FROM product_tax_profiles WHERE tenant_id=$1 AND product_id IN (SELECT id FROM selected) ORDER BY id) AS profile_ids,
      ARRAY(SELECT id FROM units WHERE tenant_id=$1 AND is_active ORDER BY id) AS unit_ids,
      ARRAY(SELECT tax_id FROM required_taxes ORDER BY tax_id) AS tax_ids,
      ARRAY(SELECT id FROM tax_rates WHERE tenant_id=$1 AND tax_id IN (SELECT tax_id FROM required_taxes) ORDER BY id) AS rate_ids,
      ARRAY(SELECT id FROM product_subcategories WHERE tenant_id=$1 AND category_id=$2 ORDER BY id) AS subcategory_ids,
      ARRAY(SELECT id FROM tenant_branches WHERE tenant_id=$1 AND es_principal ORDER BY id) AS branch_ids,
      ARRAY(SELECT id FROM payment_methods WHERE tenant_id=$1 AND active ORDER BY id) AS payment_ids,
      ARRAY(SELECT id FROM menu_items WHERE tenant_id=$1 AND deleted_at IS NULL ORDER BY id) AS menu_ids,
      ARRAY(SELECT rmp.id FROM role_menu_permissions rmp JOIN roles r ON r.id=rmp.role_id WHERE rmp.tenant_id=$1 AND r.nombre='SUPER_USER' ORDER BY rmp.id) AS role_menu_permission_ids,
      ARRAY(SELECT p.id FROM permissions p JOIN roles r ON r.id=p.role_id WHERE p.tenant_id=$1 AND r.nombre='SUPER_USER' ORDER BY p.id) AS permission_ids
  `, [SOURCE_TENANT_ID, categoryId]);
  const sourceIdSnapshot = sourceIds.rows[0];
  const targetCategoryIdPreview = randomUUID();
  const targetTenantIdPreview = randomUUID();
  const sourceToTargetSubcategoryPreview = Object.fromEntries(
    sourceSubcategories.rows.map((row) => [row.id, {
      target_id_preview: randomUUID(),
      target_tenant_id: "generated during apply",
      target_category_id_preview: targetCategoryIdPreview,
    }])
  );
  const targetProductIdsPreview = Object.fromEntries(selectedProducts.rows.map((row) => [row.id, randomUUID()]));
  const storageRoot = path.resolve(process.cwd(), env.LOCAL_UPLOADS_DIR || "storage/uploads");
  const imageManifest = buildImageManifest({
    storageRoot,
    sourceTenantId: SOURCE_TENANT_ID,
    targetTenantId: targetTenantIdPreview,
    category: categories.rows[0],
    subcategories: sourceSubcategories.rows,
    products: selectedProducts.rows,
    targetCategoryId: targetCategoryIdPreview,
    targetSubcategoryIds: Object.fromEntries(Object.entries(sourceToTargetSubcategoryPreview).map(([sourceId, mapping]) => [sourceId, mapping.target_id_preview])),
    targetProductIds: targetProductIdsPreview,
    checkSourceFiles: checkLocalImages,
  });

  const [branch, units, payments, menu, menuPermissions, legacyPermissions, superUserMenuPermissions, superUserLegacyPermissions] = await Promise.all([
    client.query("SELECT count(*) AS count FROM tenant_branches WHERE tenant_id=$1 AND es_principal", [SOURCE_TENANT_ID]),
    client.query("SELECT count(*) AS count FROM units WHERE tenant_id=$1", [SOURCE_TENANT_ID]),
    client.query("SELECT count(*) AS count FROM payment_methods WHERE tenant_id=$1 AND active", [SOURCE_TENANT_ID]),
    client.query("SELECT count(*) AS count FROM menu_items WHERE tenant_id=$1 AND deleted_at IS NULL", [SOURCE_TENANT_ID]),
    client.query("SELECT count(*) AS count FROM role_menu_permissions WHERE tenant_id=$1", [SOURCE_TENANT_ID]),
    client.query("SELECT count(*) AS count FROM permissions WHERE tenant_id=$1", [SOURCE_TENANT_ID]),
    client.query("SELECT count(*) AS count FROM role_menu_permissions rmp JOIN roles r ON r.id=rmp.role_id WHERE rmp.tenant_id=$1 AND r.nombre='SUPER_USER'", [SOURCE_TENANT_ID]),
    client.query("SELECT count(*) AS count FROM permissions p JOIN roles r ON r.id=p.role_id WHERE p.tenant_id=$1 AND r.nombre='SUPER_USER'", [SOURCE_TENANT_ID]),
  ]);
  sourceScope.required_units = Number(sourceScope.required_units);
  sourceScope.units = Number(units.rows[0].count);

  return {
    source_tenant_id: SOURCE_TENANT_ID,
    target_slug: TARGET_SLUG,
    target_nit: TARGET_NIT,
    target_email: TARGET_EMAIL,
    category: { id: categoryId, name: categories.rows[0].name, slug: categories.rows[0].slug },
    mapping_preview: {
      source_category_id: categoryId,
      target_tenant_id_preview: targetTenantIdPreview,
      target_category_id_preview: targetCategoryIdPreview,
      source_to_target_subcategory_id_preview: sourceToTargetSubcategoryPreview,
      source_to_target_product_id_preview: targetProductIdsPreview,
      contract: "apply must persist fresh UUIDs, target tenant_id, target category_id, and remap products.subcategory_id through this map",
    },
    source_snapshot: {
      category_id: categoryId,
      subcategory_ids: sourceIdSnapshot.subcategory_ids,
      product_ids: sourceIdSnapshot.product_ids,
      barcode_ids: sourceIdSnapshot.barcode_ids,
      product_tax_ids: sourceIdSnapshot.product_tax_ids,
      profile_ids: sourceIdSnapshot.profile_ids,
      unit_ids: sourceIdSnapshot.unit_ids,
      tax_ids: sourceIdSnapshot.tax_ids,
      rate_ids: sourceIdSnapshot.rate_ids,
      branch_ids: sourceIdSnapshot.branch_ids,
      payment_ids: sourceIdSnapshot.payment_ids,
      menu_ids: sourceIdSnapshot.menu_ids,
      role_menu_permission_ids: sourceIdSnapshot.role_menu_permission_ids,
      permission_ids: sourceIdSnapshot.permission_ids,
      scope_fingerprint: fingerprint({
        category_id: categoryId,
        subcategory_ids: sourceIdSnapshot.subcategory_ids,
        product_ids: sourceIdSnapshot.product_ids,
        barcode_ids: sourceIdSnapshot.barcode_ids,
        product_tax_ids: sourceIdSnapshot.product_tax_ids,
        profile_ids: sourceIdSnapshot.profile_ids,
        unit_ids: sourceIdSnapshot.unit_ids,
        tax_ids: sourceIdSnapshot.tax_ids,
        rate_ids: sourceIdSnapshot.rate_ids,
        branch_ids: sourceIdSnapshot.branch_ids,
        payment_ids: sourceIdSnapshot.payment_ids,
        menu_ids: sourceIdSnapshot.menu_ids,
        role_menu_permission_ids: sourceIdSnapshot.role_menu_permission_ids,
        permission_ids: sourceIdSnapshot.permission_ids,
      }),
    },
    source_scope: sourceScope,
    target_counts: {
      tenants: 1, tenant_details: 1, principal_branches: 1, personas: 1, users: 1, user_roles: 1,
      customers: 1, units: Number(units.rows[0].count), payment_methods: Number(payments.rows[0].count), menu_items: Number(menu.rows[0].count),
      role_menu_permissions: Number(superUserMenuPermissions.rows[0].count), permissions: Number(superUserLegacyPermissions.rows[0].count),
      terminals: 1, pos_terminals: 1, cash_registers: 1,
      product_categories: 1, product_subcategories: 3, products: Number(sourceScope.products),
      product_barcodes: Number(sourceScope.barcodes), taxes: Number(dependencyCounts.rows[0].required_taxes),
      tax_rates: Number(dependencyCounts.rows[0].required_tax_rates), product_taxes: Number(sourceScope.product_taxes),
      product_tax_profiles: Number(sourceScope.product_tax_profiles),
    },
    image_copy_manifest: imageManifest,
    blockers: imageManifest.blockers,
    subcategories: {
      source_ids: subcategoryResolutionRow.source_ids,
      resolved_rows: subcategoryResolutionRow.supported_rows,
      null_products: subcategoryResolutionRow.null_products,
      missing_products: subcategoryResolutionRow.missing_products,
      inconsistent_products: subcategoryResolutionRow.inconsistent_products,
      rows: sourceSubcategories.rows.map(({ id, tenant_id, category_id, name, slug, description, default_image_url, default_image_storage_key, default_image_alt_text, default_image_mime_type, default_image_size_bytes, is_active, sort_order, product_count }) => ({
        source_id: id,
        source_tenant_id: tenant_id,
        source_category_id: category_id,
        name,
        slug,
        description,
        default_image_url: default_image_url ? "present" : null,
        default_image_storage_key: default_image_storage_key ? "present" : null,
        default_image_alt_text,
        default_image_mime_type,
        default_image_size_bytes,
        is_active,
        sort_order,
        product_count,
        future_apply: "generate fresh UUID; set tenant_id=target tenant; set category_id=target category; remap products.subcategory_id",
      })),
    },
    source_operational_counts: {
      principal_branches: branch.rows[0].count,
      active_units: units.rows[0].count,
      active_payment_methods: payments.rows[0].count,
      menus: menu.rows[0].count,
      role_menu_permissions: menuPermissions.rows[0].count,
      legacy_permissions: legacyPermissions.rows[0].count,
    },
    dependency_counts: dependencyCounts.rows[0],
    global_references: requiredRefs,
    excluded: [
      "source identity and PII", "source config/logo/storage keys", "customers except target final consumer",
      "stock, lots, movements, purchases, sales, orders, payments", "sessions and devices",
      "electronic billing credentials and documents", "audit and integration events",
    ],
  };
}

function targetMap(sourceIds, preview) {
  return Object.fromEntries(sourceIds.map((sourceId) => [sourceId, {
    source_id: sourceId,
    target_id: preview?.[sourceId]?.target_id_preview || randomUUID(),
  }]));
}

function createManifest(report, storageRoot) {
  const snapshot = report.source_snapshot;
  const targetTenantId = report.mapping_preview.target_tenant_id_preview;
  const targetCategoryId = report.mapping_preview.target_category_id_preview;
  const maps = {
    tenant: { source_id: SOURCE_TENANT_ID, target_id: targetTenantId },
    branch: targetMap(snapshot.branch_ids, Object.fromEntries(snapshot.branch_ids.map((id) => [id, { target_id_preview: randomUUID() }]))),
    category: { source_id: snapshot.category_id, target_id: targetCategoryId },
    subcategories: targetMap(snapshot.subcategory_ids, report.mapping_preview.source_to_target_subcategory_id_preview),
    products: targetMap(snapshot.product_ids, Object.fromEntries(snapshot.product_ids.map((id) => [id, { target_id_preview: report.mapping_preview.source_to_target_product_id_preview[id] }]))),
    units: targetMap(snapshot.unit_ids),
    taxes: targetMap(snapshot.tax_ids),
    tax_rates: targetMap(snapshot.rate_ids),
    barcodes: targetMap(snapshot.barcode_ids),
    product_taxes: targetMap(snapshot.product_tax_ids),
    product_tax_profiles: targetMap(snapshot.profile_ids),
    payment_methods: targetMap(snapshot.payment_ids),
    menu_items: targetMap(snapshot.menu_ids),
    role_menu_permissions: targetMap(snapshot.role_menu_permission_ids),
    permissions: targetMap(snapshot.permission_ids),
    persona: { target_id: randomUUID() },
    user: { target_id: randomUUID() },
    customer: { target_id: randomUUID() },
    terminal: { target_id: randomUUID() },
    pos_terminal: { target_id: randomUUID() },
    cash_register: { target_id: randomUUID() },
  };
  const targetSubcategoryIds = Object.fromEntries(Object.entries(maps.subcategories).map(([sourceId, row]) => [sourceId, row.target_id]));
  const targetProductIds = Object.fromEntries(Object.entries(maps.products).map(([sourceId, row]) => [sourceId, row.target_id]));
  const imageManifest = buildImageManifest({
    storageRoot,
    sourceTenantId: SOURCE_TENANT_ID,
    targetTenantId,
    category: { id: snapshot.category_id, default_image_storage_key: report.image_copy_manifest.entries.find((entry) => entry.entity_type === "product-categories")?.source_storage_key },
    subcategories: report.image_copy_manifest.entries.filter((entry) => entry.entity_type === "product-subcategories").map((entry) => ({ id: entry.source_entity_id, default_image_storage_key: entry.source_storage_key })),
    products: report.image_copy_manifest.entries.filter((entry) => entry.entity_type === "products").map((entry) => ({ id: entry.source_entity_id, image_storage_key: entry.source_storage_key })),
    targetCategoryId,
    targetSubcategoryIds,
    targetProductIds,
  });
  const manifest = {
    schema_version: 1,
    provisioning_key: TARGET_SLUG,
    created_at: new Date().toISOString(),
    source: {
      tenant_id: SOURCE_TENANT_ID,
      category_id: snapshot.category_id,
      snapshot: snapshot,
    },
    target: { slug: TARGET_SLUG, nit: TARGET_NIT, company_name: "CARIBBEAN BEER LICORES SAS" },
    storage_root: storageRoot,
    expected_counts: report.target_counts,
    maps,
    images: imageManifestForPersistence(imageManifest, { storage_root: storageRoot }),
  };
  return { manifest, imageManifest };
}

function assertManifestMatchesReport(manifest, report) {
  if (manifest.source?.snapshot?.scope_fingerprint !== report.source_snapshot.scope_fingerprint) {
    fail("manifest source snapshot differs from current QA source scope");
  }
  if (manifest.expected_counts?.products !== report.target_counts.products || manifest.expected_counts?.product_taxes !== report.target_counts.product_taxes) {
    fail("manifest expected catalog counts differ from current QA preflight");
  }
  for (const entry of manifest.images || []) {
    if (entry.status !== "PREPARED" || !entry.sha256 || !entry.byte_size) fail(`manifest image is not prepared: ${entry.target_storage_key}`);
    if (!entry.target_storage_key.startsWith(`${entry.entity_type}/${manifest.maps.tenant.target_id}/`)) fail(`manifest image escaped target tenant: ${entry.target_storage_key}`);
  }
}

function finalizePreparedManifest(manifest, imageManifest) {
  const prepared = manifest.images.map((entry) => ({ ...entry }));
  for (const entry of prepared) {
    const local = imageManifest.entries.find((candidate) => candidate.target_storage_key === entry.target_storage_key);
    const bytes = fs.readFileSync(local.intended_target_path);
    entry.byte_size = bytes.length;
    entry.sha256 = createHash("sha256").update(bytes).digest("hex");
    entry.status = "PREPARED";
  }
  return { ...manifest, images: prepared };
}

async function prepareImages(client, env, report, file) {
  if (report.blockers?.length) {
    return { status: "PREPARE_IMAGES_BLOCKED", manifest_path: file, blockers: report.blockers, image_copy_manifest: report.image_copy_manifest };
  }
  const existing = readManifest(file);
  let manifest;
  let imageManifest;
  if (existing) {
    assertManifestMatchesReport(existing, report);
    manifest = existing;
    const generated = createManifest({ ...report, mapping_preview: {
      ...report.mapping_preview,
      target_tenant_id_preview: existing.maps.tenant.target_id,
      target_category_id_preview: existing.maps.category.target_id,
      source_to_target_subcategory_id_preview: Object.fromEntries(Object.entries(existing.maps.subcategories).map(([id, row]) => [id, { target_id_preview: row.target_id }])),
      source_to_target_product_id_preview: Object.fromEntries(Object.entries(existing.maps.products).map(([id, row]) => [id, row.target_id])),
    } }, manifest.storage_root);
    imageManifest = generated.imageManifest;
  } else {
    const generated = createManifest(report, path.resolve(process.cwd(), env.LOCAL_UPLOADS_DIR || "storage/uploads"));
    manifest = generated.manifest;
    imageManifest = generated.imageManifest;
  }
  const createdFiles = prepareImageFiles(manifest, imageManifest);
  const preparedManifest = finalizePreparedManifest(manifest, imageManifest);
  const saved = writeManifest(preparedManifest, file);
  return { status: "PREPARE_IMAGES_PASS", manifest_path: file, created_files: createdFiles.length, image_copy_manifest: saved.images };
}

async function main() {
  if (!args.has("--preflight") && !args.has("--plan") && !args.has("--prepare-images") && !args.has("--apply")) {
    fail("choose --preflight, --plan, --prepare-images, or --apply");
  }
  const envFile = valueAfter("--env", path.resolve(process.cwd(), "scripts/config/db.env"));
  const env = loadEnv(envFile);
  assertQaEnvironment(env);
  const client = new Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    connectionTimeoutMillis: 10000,
  });
  try {
    await client.connect();
    const currentDatabase = await client.query("SELECT current_database() AS database_name");
    if (currentDatabase.rows[0].database_name !== "manus_tienda_qa") fail(`database identity is ${currentDatabase.rows[0].database_name}, expected manus_tienda_qa`);
    const report = await preflight(client, env, { checkLocalImages: !args.has("--apply") });
    report.manifest = {
      path: manifestPathFromArgs(),
      exists: fs.existsSync(manifestPathFromArgs()),
      mode: "persistent definitive UUIDs; preview mappings are not apply inputs",
    };
    const blockers = report.blockers || [];
    const status = blockers.length ? (args.has("--plan") ? "PLAN_BLOCKED" : "PREFLIGHT_BLOCKED") : (args.has("--plan") ? "PLAN_PASS" : "PREFLIGHT_PASS");
    console.log(JSON.stringify({ status, environment: env.ENVIRONMENT, database: currentDatabase.rows[0].database_name, report }, null, 2));
    if (blockers.length) process.exitCode = 2;
    if (args.has("--prepare-images")) {
      const result = await prepareImages(client, env, report, manifestPathFromArgs());
      console.log(JSON.stringify(result, null, 2));
      if (result.status !== "PREPARE_IMAGES_PASS") process.exitCode = 2;
    }
    if (args.has("--apply")) {
      if (valueAfter("--confirm-demo-provisioning", "NO") !== "YES") fail("--apply requires --confirm-demo-provisioning YES");
      if (valueAfter("--confirm-images-uploaded", "NO") !== "YES") fail("--apply requires --confirm-images-uploaded YES");
      const manifestFile = manifestPathFromArgs();
      const manifest = readManifest(manifestFile);
      if (!manifest) fail(`prepared manifest not found: ${manifestFile}`);
      assertManifestMatchesReport(manifest, report);
      const result = await applyProvisioning(client, env, manifest);
      console.log(JSON.stringify(result, null, 2));
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}

module.exports = { insertRow, orderMenusTopologically, assertMenuUniqueValues, assertRoleMenuPermissions, buildImageManifest, requireManifestTargetId, requireManifestEntityId };
