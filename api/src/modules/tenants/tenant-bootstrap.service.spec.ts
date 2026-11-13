import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import {
  ConflictException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { PlatformTenantGuard } from "../../common/guards/platform-tenant.guard";
import { TenantsController } from "./tenants.controller";
import { TenantsService, isTenantBootstrapEnabled } from "./tenants.service";
import {
  TenantBootstrapError,
  TenantBootstrapService,
  type BootstrapSqlClient,
} from "./tenant-bootstrap.service";
import { TENANT_BOOTSTRAP_MATRIX } from "./tenant-bootstrap.policy";

const PLATFORM = "00000000-0000-0000-0000-000000000001";
const TARGET = "11111111-1111-4111-8111-111111111111";

type Call = { text: string; params?: unknown[] };

const buildClient = (handler: (text: string, params?: unknown[]) => { rows: any[] } | Error) => {
  const calls: Call[] = [];
  let released = 0;
  const client = {
    query: async (text: string, params?: unknown[]) => {
      calls.push({ text, params });
      const outcome = handler(text, params);
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
    release: () => {
      released += 1;
    },
  };
  return { client, calls, released: () => released };
};

const buildService = (
  client: ReturnType<typeof buildClient>["client"],
  bootstrap: TenantBootstrapService["bootstrap"],
) => {
  const db = {
    query: async (text: string) => {
      if (text.startsWith("SELECT 1 FROM tenants WHERE slug")) return { rows: [] };
      if (text.startsWith("INSERT INTO tenants")) {
        return { rows: [{ id: TARGET, slug: "acme", nombre: "Acme", activo: true, config: {} }] };
      }
      throw new Error(`unexpected db.query ${text}`);
    },
    getClient: async () => client,
  };
  const bootstrapService = { bootstrap } as unknown as TenantBootstrapService;
  return new TenantsService(db as any, bootstrapService);
};

const tenantRow = { rows: [{ id: TARGET, slug: "acme", nombre: "Acme", activo: true, config: {} }] };

test("createTenant creates and bootstraps in one REPEATABLE READ transaction", async () => {
  const fake = buildClient((text) => (text.startsWith("INSERT INTO tenants") ? tenantRow : { rows: [] }));
  let received: unknown;
  const service = buildService(fake.client, async (client, input) => {
    assert.equal(client, fake.client, "bootstrap must reuse the transaction client");
    received = input;
    return {
      status: "COMPLETED",
      version: "v",
      sourceTenantId: PLATFORM,
      targetTenantId: TARGET,
      counts: {} as any,
      manual: [],
    };
  });

  const created = await service.createTenant({ nombre: "Acme" }, { userId: "22222222-2222-4222-8222-222222222222" });

  assert.equal(created.id, TARGET);
  assert.equal(created.bootstrap.status, "COMPLETED");
  assert.deepEqual(received, {
    targetTenantId: TARGET,
    sourceTenantId: PLATFORM,
    actorUserId: "22222222-2222-4222-8222-222222222222",
  });
  assert.deepEqual(
    fake.calls.map((call) => call.text.split(" (")[0]),
    ["BEGIN ISOLATION LEVEL REPEATABLE READ", "INSERT INTO tenants", "COMMIT"],
  );
  assert.equal(fake.released(), 1);
});

test("createTenant rolls back the tenant when bootstrap fails and maps the error", async () => {
  const fake = buildClient((text) => (text.startsWith("INSERT INTO tenants") ? tenantRow : { rows: [] }));
  const service = buildService(fake.client, async () => {
    throw new TenantBootstrapError("TENANT_BOOTSTRAP_SOURCE_MISSING", "El tenant origen no existe");
  });

  await assert.rejects(() => service.createTenant({ nombre: "Acme" }), ServiceUnavailableException);
  const texts = fake.calls.map((call) => call.text);
  assert.ok(texts.includes("ROLLBACK"));
  assert.ok(!texts.includes("COMMIT"));
  assert.equal(fake.released(), 1);
});

test("createTenant maps bootstrap error codes to HTTP statuses", async () => {
  const cases: Array<[TenantBootstrapError["code"], new (...args: any[]) => Error]> = [
    ["TENANT_BOOTSTRAP_TARGET_NOT_EMPTY", ConflictException],
    ["TENANT_BOOTSTRAP_SOURCE_INCOMPLETE", ServiceUnavailableException],
    ["TENANT_BOOTSTRAP_INTEGRITY_FAILED", UnprocessableEntityException],
  ];
  for (const [code, expected] of cases) {
    const fake = buildClient((text) => (text.startsWith("INSERT INTO tenants") ? tenantRow : { rows: [] }));
    const service = buildService(fake.client, async () => {
      throw new TenantBootstrapError(code, code);
    });
    await assert.rejects(() => service.createTenant({ nombre: "Acme" }), expected);
  }
});

test("createTenant maps a concurrent slug collision to 409 after rollback", async () => {
  const collision = Object.assign(new Error("duplicate key"), { code: "23505", constraint: "tenants_slug_key" });
  const fake = buildClient((text) => (text.startsWith("INSERT INTO tenants") ? collision : { rows: [] }));
  const service = buildService(fake.client, async () => {
    throw new Error("bootstrap must not run");
  });
  await assert.rejects(() => service.createTenant({ nombre: "Acme" }), ConflictException);
  assert.ok(fake.calls.some((call) => call.text === "ROLLBACK"));
});

test("TENANT_BOOTSTRAP_ENABLED=false keeps the legacy creation path", async () => {
  const previous = process.env.TENANT_BOOTSTRAP_ENABLED;
  process.env.TENANT_BOOTSTRAP_ENABLED = "false";
  try {
    const fake = buildClient(() => new Error("transaction client must not be used"));
    const service = buildService(fake.client, async () => {
      throw new Error("bootstrap must not run");
    });
    const created = await service.createTenant({ nombre: "Acme" });
    assert.equal(created.id, TARGET);
    assert.equal(fake.calls.length, 0);
  } finally {
    if (previous === undefined) delete process.env.TENANT_BOOTSTRAP_ENABLED;
    else process.env.TENANT_BOOTSTRAP_ENABLED = previous;
  }
});

test("isTenantBootstrapEnabled defaults to enabled", () => {
  assert.equal(isTenantBootstrapEnabled({}), true);
  assert.equal(isTenantBootstrapEnabled({ TENANT_BOOTSTRAP_ENABLED: "FALSE" }), false);
  assert.equal(isTenantBootstrapEnabled({ TENANT_BOOTSTRAP_ENABLED: "true" }), true);
});

test("tenant creation requires SUPER_ADMIN of the platform tenant", () => {
  const handler = TenantsController.prototype.create;
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, handler), ["SUPER_ADMIN"]);
  const guards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
  assert.ok(guards.includes(PlatformTenantGuard), "POST /tenants must use PlatformTenantGuard");
});

test("bootstrap rejects invalid or identical tenants before touching data", async () => {
  const service = new TenantBootstrapService();
  const calls: string[] = [];
  const client: BootstrapSqlClient = {
    query: async (text) => {
      calls.push(text);
      return { rows: [] };
    },
  };
  await assert.rejects(
    () => service.bootstrap(client, { targetTenantId: "x", sourceTenantId: PLATFORM }),
    (error: unknown) => error instanceof TenantBootstrapError && error.code === "TENANT_BOOTSTRAP_INVALID_INPUT",
  );
  await assert.rejects(
    () => service.bootstrap(client, { targetTenantId: PLATFORM, sourceTenantId: PLATFORM }),
    (error: unknown) => error instanceof TenantBootstrapError && error.code === "TENANT_BOOTSTRAP_INVALID_INPUT",
  );
  assert.equal(calls.length, 0);
});

test("bootstrap sends tenant values only as bind parameters", async () => {
  const service = new TenantBootstrapService();
  const texts: string[] = [];
  const client: BootstrapSqlClient = {
    query: async (text) => {
      texts.push(text);
      if (text.includes("FROM tenants WHERE id = ANY")) {
        return { rows: [{ id: TARGET, activo: true }, { id: PLATFORM, activo: true }] };
      }
      return { rows: [] };
    },
  };
  // Sin menú en el origen la ejecución termina con SOURCE_INCOMPLETE.
  await assert.rejects(
    () => service.bootstrap(client, { targetTenantId: TARGET, sourceTenantId: PLATFORM }),
    (error: unknown) => error instanceof TenantBootstrapError && error.code === "TENANT_BOOTSTRAP_SOURCE_INCOMPLETE",
  );
  for (const text of texts) {
    assert.ok(!text.includes(TARGET) && !text.includes(PLATFORM), "tenant ids must not be interpolated");
  }
});

test("clone matrix never copies operational or secret data", () => {
  const forbidden = ["users", "tenant_branches", "products", "sales", "tenant_electronic_billing_configs", "tenant_settings"];
  for (const name of forbidden) {
    const entry = TENANT_BOOTSTRAP_MATRIX.find((row) => row.table.split(/[ ,]+/).includes(name) || row.table.startsWith(name));
    assert.ok(entry, `matrix must classify ${name}`);
    assert.notEqual(entry.decision, "COPY", `${name} must not be copied`);
  }
});
