import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { DatabaseService } from "../src/common/db/database.service";
import { ProductImportRepository } from "../src/modules/inventory/product-import/product-import.repository";
import { ProductImportService } from "../src/modules/inventory/product-import/product-import.service";
import {
  fillProductTemplate,
  fillStockTemplate,
  InventoryReportFormatError,
  parseInventoryReport,
  planInventoryReport,
  type InventoryReportPlan,
} from "../src/modules/inventory/report-conversion/inventory-report.converter";
import { ProductCategoryRepository } from "../src/modules/inventory/repositories/product-category.repository";
import { ProductSubcategoryRepository } from "../src/modules/inventory/repositories/product-subcategory.repository";
import { TaxRepository } from "../src/modules/inventory/repositories/tax.repository";
import { UnitRepository } from "../src/modules/inventory/repositories/unit.repository";
import { StockImportRepository } from "../src/modules/inventory/stock-import/stock-import.repository";
import { StockImportService } from "../src/modules/inventory/stock-import/stock-import.service";

const USAGE = `
Uso:
  npm run inventory:convert-report -- "<Reporte de Inventario.xlsx>" [opciones]

Opciones:
  --tenant <slug|id>     Tienda (obligatorio solo si hay más de una activa).
  --sucursal <codigo>    Sucursal del stock (por defecto la principal).
  --prefijo <texto>      Prefijo del SKU (por defecto XLS-).
  --salida <carpeta>     Carpeta de salida (por defecto la del reporte).
  --env <archivo>        Archivo .env con la conexión a la base.
`;

type CliOptions = {
  input: string;
  tenant?: string;
  branch?: string;
  skuPrefix: string;
  outputDir?: string;
  envFile?: string;
};

class CliError extends Error {}

const ACTOR = { id: null } as never;
const ALLOW_ALL_BRANCHES = { canAccessBranch: async () => true } as never;
const READ_ONLY_SQL = /^\s*(select|with)\b/i;
const WRITE_SQL = /\b(insert|update|delete|merge|alter|drop|create|truncate|grant|revoke|copy|lock)\b/i;

function parseArgs(argv: string[]): CliOptions {
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      console.log(USAGE);
      process.exit(0);
    }
    if (arg.startsWith("--")) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new CliError(`Falta el valor de ${arg}.`);
      }
      flags[arg.slice(2)] = value;
      index += 1;
    } else {
      positional.push(arg);
    }
  }
  const unknown = Object.keys(flags).filter(
    (flag) => !["tenant", "sucursal", "prefijo", "salida", "env"].includes(flag)
  );
  if (unknown.length > 0) {
    throw new CliError(`Opción desconocida: --${unknown[0]}.${USAGE}`);
  }
  const input = positional.join(" ").trim().replace(/^"|"$/g, "");
  if (!input) {
    throw new CliError(`Indica el archivo del reporte.${USAGE}`);
  }
  return {
    input: path.resolve(input),
    tenant: flags.tenant,
    branch: flags.sucursal,
    skuPrefix: flags.prefijo ?? "XLS-",
    outputDir: flags.salida ? path.resolve(flags.salida) : undefined,
    envFile: flags.env ? path.resolve(flags.env) : undefined,
  };
}

function loadDatabaseEnv(envFile?: string) {
  const apiDir = path.resolve(__dirname, "..");
  const candidates = envFile
    ? [envFile]
    : [
        path.join(apiDir, ".env"),
        path.join(apiDir, "..", ".env"),
        path.join(apiDir, "..", "backend-reporteria", ".env"),
      ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new CliError(`No se encontró el archivo de conexión (.env). Buscado en:\n  ${candidates.join("\n  ")}`);
  }
  loadEnv({ path: found, quiet: true });
  process.env.PGOPTIONS = "-c default_transaction_read_only=on";
  return found;
}

function createReadOnlyDatabase() {
  const db = new DatabaseService();
  const query = db.query.bind(db);
  db.query = (async (text: string, params?: unknown[]) => {
    if (!READ_ONLY_SQL.test(text) || WRITE_SQL.test(text)) {
      throw new Error("La herramienta solo lee la base: se bloqueó una escritura.");
    }
    return query(text, params);
  }) as typeof db.query;
  db.getClient = (async () => {
    throw new Error("La herramienta solo lee la base: no abre transacciones.");
  }) as typeof db.getClient;
  return db;
}

async function resolveTenant(db: DatabaseService, wanted?: string) {
  const { rows } = await db.query<{ id: string; slug: string; nombre: string }>(
    `SELECT id, slug, nombre FROM tenants WHERE activo = TRUE ORDER BY nombre`
  );
  const list = rows.map((row) => `  ${row.slug}  (${row.nombre})`).join("\n");
  if (wanted) {
    const key = wanted.trim().toLowerCase();
    const tenant = rows.find((row) => row.id === key || row.slug.toLowerCase() === key);
    if (!tenant) {
      throw new CliError(`No existe la tienda "${wanted}". Tiendas activas:\n${list}`);
    }
    return tenant;
  }
  if (rows.length === 1) {
    return rows[0];
  }
  throw new CliError(
    rows.length === 0
      ? "No hay tiendas activas en la base."
      : `Hay varias tiendas: indica una con --tenant <slug>.\n${list}`
  );
}

async function resolveBranch(repository: StockImportRepository, tenantId: string, wanted?: string) {
  const branches = (await repository.listBranches(tenantId)).filter((branch) => branch.isActive);
  if (branches.length === 0) {
    throw new CliError("La tienda no tiene sucursales activas.");
  }
  if (!wanted) {
    return branches[0];
  }
  const branch = branches.find((item) => item.code.toUpperCase() === wanted.trim().toUpperCase());
  if (!branch) {
    throw new CliError(
      `No existe la sucursal "${wanted}". Sucursales activas: ${branches.map((item) => item.code).join(", ")}.`
    );
  }
  return branch;
}

async function loadExistingProducts(db: DatabaseService, tenantId: string, branchId: string) {
  const [products, barcodes, stock] = await Promise.all([
    db.query<{ sku: string }>(
      `SELECT UPPER(BTRIM(sku)) AS sku FROM products WHERE tenant_id = $1`,
      [tenantId]
    ),
    db.query<{ barcode: string; sku: string }>(
      `
        SELECT b.barcode, UPPER(BTRIM(p.sku)) AS sku
        FROM product_barcodes b
        JOIN products p ON p.id = b.product_id
        WHERE b.tenant_id = $1 AND b.is_active = TRUE
      `,
      [tenantId]
    ),
    db.query<{ sku: string; stock: string | number }>(
      `
        SELECT
          UPPER(BTRIM(p.sku)) AS sku,
          COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'IN'), 0)
            - COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'OUT'), 0) AS stock
        FROM products p
        JOIN stock_movements m
          ON m.product_id = p.id AND m.tenant_id = p.tenant_id AND m.branch_id = $2
        WHERE p.tenant_id = $1
        GROUP BY 1
      `,
      [tenantId, branchId]
    ),
  ]);
  return {
    skus: new Set(products.rows.map((row) => row.sku)),
    barcodes: new Map(barcodes.rows.map((row) => [row.barcode, row.sku])),
    stock: new Map(stock.rows.map((row) => [row.sku, Number(row.stock)])),
  };
}

function withPlannedProducts(repository: StockImportRepository, plan: InventoryReportPlan) {
  const planned = new Map(
    plan.items
      .filter((item) => !item.exists)
      .map((item, index) => [
        item.sku.toUpperCase(),
        {
          id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          sku: item.sku,
          name: item.name,
          isActive: true,
          requiresLot: false,
          requiresExpiration: false,
          cost: item.source.cost,
        },
      ])
  );
  const findProducts = repository.findProducts.bind(repository);
  repository.findProducts = async (tenantId, keys, client) => {
    const found = await findProducts(tenantId, keys, client);
    const foundSkus = new Set(found.products.map((product) => product.sku.toUpperCase()));
    const synthetic = keys.skus
      .filter((sku) => !foundSkus.has(sku))
      .map((sku) => planned.get(sku))
      .filter((product) => product !== undefined);
    return { ...found, products: [...found.products, ...synthetic] };
  };
  return repository;
}

function writeOutput(filePath: string, buffer: Buffer) {
  try {
    writeFileSync(filePath, buffer);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EBUSY" || code === "EPERM") {
      throw new CliError(`No se pudo guardar ${path.basename(filePath)}: ciérralo en Excel y vuelve a intentar.`);
    }
    throw error;
  }
}

function printErrors(title: string, rows: Array<{ rowNumber: number; sku: string; errors: string[] }>) {
  const withErrors = rows.filter((row) => row.errors.length > 0);
  if (withErrors.length === 0) {
    return;
  }
  console.log(`\n  ${title}: ${withErrors.length} fila(s) con errores`);
  for (const row of withErrors.slice(0, 25)) {
    console.log(`    fila ${row.rowNumber} ${row.sku}: ${row.errors.join(" / ")}`);
  }
  if (withErrors.length > 25) {
    console.log(`    ... y ${withErrors.length - 25} más (ver prevalidación en el sistema).`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!existsSync(options.input)) {
    throw new CliError(`No existe el archivo: ${options.input}`);
  }
  const envFile = loadDatabaseEnv(options.envFile);

  console.log(`\nLeyendo reporte: ${path.basename(options.input)}`);
  const report = await parseInventoryReport(readFileSync(options.input));

  const db = createReadOnlyDatabase();
  const tenant = await resolveTenant(db, options.tenant);
  const stockRepository = new StockImportRepository(db);
  const branch = await resolveBranch(stockRepository, tenant.id, options.branch);
  console.log(`Tienda: ${tenant.nombre} (${tenant.slug}) | Sucursal: ${branch.code} | Conexión: ${path.basename(path.dirname(envFile))}/${path.basename(envFile)}`);

  const existing = await loadExistingProducts(db, tenant.id, branch.id);
  const plan = planInventoryReport(report.rows, {
    skuPrefix: options.skuPrefix,
    existingSkus: existing.skus,
    existingBarcodes: existing.barcodes,
  });
  if (plan.items.length === 0) {
    throw new CliError("El reporte no tiene productos inventariables para cargar.");
  }

  const productService = new ProductImportService(
    new ProductImportRepository(db),
    new UnitRepository(db),
    new TaxRepository(db),
    new ProductCategoryRepository(db),
    new ProductSubcategoryRepository(db),
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    ALLOW_ALL_BRANCHES
  );
  const stockService = new StockImportService(
    withPlannedProducts(stockRepository, plan),
    db,
    null as never,
    ALLOW_ALL_BRANCHES
  );

  const productsFile = await fillProductTemplate(await productService.buildTemplate(tenant.id), plan);
  const stockFile = await fillStockTemplate(
    await stockService.buildTemplate(tenant.id, ACTOR, { branchId: branch.id }),
    plan,
    { branchCode: branch.code, currentStock: existing.stock }
  );

  const date = report.exportDate ?? new Date().toISOString().slice(0, 10);
  const outputDir = options.outputDir ?? path.dirname(options.input);
  const productsPath = path.join(outputDir, `1_carga_productos_${date}.xlsx`);
  const stockPath = path.join(outputDir, `2_carga_stock_${date}.xlsx`);
  writeOutput(productsPath, productsFile);
  writeOutput(stockPath, stockFile);

  const productCheck = await productService.validate(tenant.id, ACTOR, productsFile);
  const stockCheck = await stockService.validate(tenant.id, ACTOR, stockFile);
  const created = plan.items.filter((item) => !item.exists).length;
  const negatives = plan.items.filter((item) => item.source.stock < 0).length;
  const review = plan.items.filter((item) => item.notes.some((note) => /revisar|provisional|reemplazar/i.test(note))).length;
  const stockSummary = stockCheck.report.summary;

  console.log(`
Resultado
  Filas del reporte:   ${report.rows.length}
  Productos:           ${plan.items.length} (${created} nuevos, ${plan.items.length - created} ya existían)
  Omitidos:            ${plan.skipped.length}
  Con código barras:   ${plan.items.filter((item) => item.barcode).length}
  Existencia negativa: ${negatives} (se cargan en 0)
  Para revisar:        ${review} (ver hoja "Revision")

Prevalidación (igual que en el sistema)
  Productos: ${productCheck.report.canCommit ? "OK" : "CON ERRORES"} | ${productCheck.report.summary.total} filas
  Stock:     ${stockCheck.report.canCommit ? "OK" : "CON ERRORES"} | entra ${stockSummary.in} (+${stockSummary.quantityIn}), sale ${stockSummary.out} (-${stockSummary.quantityOut}), sin cambio ${stockSummary.unchanged}`);
  printErrors("Productos", productCheck.report.rows);
  printErrors("Stock", stockCheck.report.rows);

  console.log(`
Archivos generados:
  ${productsPath}
  ${stockPath}

Siguiente paso:
  1. Revisa la hoja "Revision" del archivo de productos (precio DANE, grado, volumen).
  2. En Inventario > Productos usa "Carga masiva" con el archivo 1 y confirma.
  3. Luego usa "Carga de stock" con el archivo 2 y confirma.
`);

  return productCheck.report.canCommit && stockCheck.report.canCommit ? 0 : 2;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    if (error instanceof CliError || error instanceof InventoryReportFormatError) {
      console.error(`\nERROR: ${error.message}\n`);
    } else if (error && typeof error === "object" && "message" in error) {
      const message = String((error as { message: unknown }).message);
      console.error(`\nERROR inesperado: ${message}\n`);
    } else {
      console.error("\nERROR inesperado.\n");
    }
    process.exit(1);
  });
