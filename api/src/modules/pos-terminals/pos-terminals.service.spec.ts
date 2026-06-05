import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { PosTerminalsService } from "./pos-terminals.service";
import type {
  PosTerminalPeripheralSettingsRecord,
  PosTerminalRecord,
} from "./pos-terminals.repository";

const tenantId = randomUUID();
const branchId = randomUUID();
const terminalId = randomUUID();

const actor = {
  roles: ["ADMIN"],
  tenantId,
  userId: randomUUID(),
};

const buildTerminal = (
  overrides: Partial<PosTerminalRecord> = {}
): PosTerminalRecord => ({
  id: terminalId,
  tenant_id: tenantId,
  branch_id: branchId,
  branch_name: "Sucursal Principal",
  code: "local-terminal",
  name: "Terminal local",
  description: null,
  active: true,
  mode: "MOCK",
  created_at: "2026-06-05T00:00:00.000Z",
  updated_at: "2026-06-05T00:00:00.000Z",
  ...overrides,
});

const buildSettings = (
  overrides: Partial<PosTerminalPeripheralSettingsRecord> = {}
): PosTerminalPeripheralSettingsRecord => ({
  id: randomUUID(),
  terminal_id: terminalId,
  printer_device_id: "mock-printer-001",
  cash_drawer_device_id: "mock-cashdrawer-001",
  scale_device_id: "mock-scale-001",
  scanner_device_id: "mock-scanner-001",
  enable_print_sale: true,
  enable_print_purchase: true,
  enable_print_order: true,
  enable_open_drawer: true,
  enable_scale: true,
  enable_scanner: true,
  created_at: "2026-06-05T00:00:00.000Z",
  updated_at: "2026-06-05T00:00:00.000Z",
  ...overrides,
});

const buildService = (
  options: {
    terminals?: PosTerminalRecord[];
    settings?: PosTerminalPeripheralSettingsRecord | null;
    branchExists?: boolean;
  } = {}
) => {
  const terminals = options.terminals ?? [buildTerminal()];
  let settings = options.settings ?? buildSettings();
  const calls: string[] = [];

  const repository = {
    validateBranch: async () => options.branchExists ?? true,
    findPrincipalBranch: async () => ({
      id: branchId,
      tenant_id: tenantId,
      nombre: "Sucursal Principal",
    }),
    existsCodeInBranch: async () => false,
    findAll: async () => terminals,
    findById: async (id: string) =>
      terminals.find((terminal) => terminal.id === id) ?? null,
    findByCode: async (_tenantId: string, _branchId: string, code: string) =>
      terminals.find((terminal) => terminal.code === code) ?? null,
    findDefaultForBranch: async () => terminals[0] ?? null,
    create: async (data: any) => {
      calls.push("create");
      const created = buildTerminal({
        id: randomUUID(),
        tenant_id: data.tenantId,
        branch_id: data.branchId,
        code: data.code,
        name: data.name,
        description: data.description,
        active: data.active,
        mode: data.mode,
      });
      terminals.push(created);
      return created;
    },
    update: async (id: string, _tenantId: string, data: any) => {
      calls.push("update");
      const current = terminals.find((terminal) => terminal.id === id);
      return current
        ? buildTerminal({
            ...current,
            branch_id: data.branchId ?? current.branch_id,
            code: data.code ?? current.code,
            name: data.name ?? current.name,
            description:
              data.description === undefined
                ? current.description
                : data.description,
            active: data.active ?? current.active,
            mode: data.mode ?? current.mode,
          })
        : null;
    },
    findSettingsByTerminalId: async () => settings,
    upsertSettings: async (_terminalId: string, data: any) => {
      calls.push("upsertSettings");
      settings = buildSettings({
        printer_device_id: data.printerDeviceId,
        cash_drawer_device_id: data.cashDrawerDeviceId,
        scale_device_id: data.scaleDeviceId,
        scanner_device_id: data.scannerDeviceId,
        enable_print_sale: data.enablePrintSale,
        enable_print_purchase: data.enablePrintPurchase,
        enable_print_order: data.enablePrintOrder,
        enable_open_drawer: data.enableOpenDrawer,
        enable_scale: data.enableScale,
        enable_scanner: data.enableScanner,
      });
      return settings;
    },
  };

  return {
    service: new PosTerminalsService(repository as any),
    calls,
  };
};

describe("PosTerminalsService", () => {
  it("creates a POS terminal for a tenant branch", async () => {
    const { service, calls } = buildService({ terminals: [] });

    const created = await service.createTerminal(
      {
        tenantId,
        branchId,
        code: "CAJA-01",
        name: "Caja 01",
        mode: "MOCK",
      },
      actor
    );

    assert.equal(created.tenantId, tenantId);
    assert.equal(created.branchId, branchId);
    assert.equal(created.code, "CAJA-01");
    assert.equal(created.mode, "MOCK");
    assert.deepEqual(calls, ["create"]);
  });

  it("updates a POS terminal", async () => {
    const { service, calls } = buildService();

    const updated = await service.updateTerminal(
      terminalId,
      { name: "Caja principal", active: false, mode: "HYBRID" },
      actor
    );

    assert.equal(updated.name, "Caja principal");
    assert.equal(updated.active, false);
    assert.equal(updated.mode, "HYBRID");
    assert.deepEqual(calls, ["update"]);
  });

  it("lists terminals by tenant and branch", async () => {
    const { service } = buildService();

    const result = await service.listTerminals({ tenantId, branchId }, actor);

    assert.equal(result.length, 1);
    assert.equal(result[0].code, "local-terminal");
  });

  it("gets a terminal by id", async () => {
    const { service } = buildService();

    const result = await service.getTerminal(terminalId, actor);

    assert.equal(result.id, terminalId);
    assert.equal(result.branchId, branchId);
  });

  it("saves peripheral settings", async () => {
    const { service, calls } = buildService();

    const settings = await service.savePeripheralSettings(
      terminalId,
      {
        printerDeviceId: "network-printer-001",
        enablePrintSale: false,
      },
      actor
    );

    assert.equal(settings.printerDeviceId, "network-printer-001");
    assert.equal(settings.features.printSale, false);
    assert.equal(settings.cashDrawerDeviceId, "mock-cashdrawer-001");
    assert.deepEqual(calls, ["upsertSettings"]);
  });

  it("resolves configured terminal with peripheral settings", async () => {
    const { service } = buildService({
      settings: buildSettings({
        printer_device_id: "network-printer-001",
        enable_scanner: false,
      }),
    });

    const result = await service.resolveCurrent(
      { tenantId, branchId },
      actor
    );

    assert.equal(result.source, "CONFIGURED");
    assert.equal(result.terminalId, "local-terminal");
    assert.equal(result.printerDeviceId, "network-printer-001");
    assert.equal(result.features.scanner, false);
  });

  it("resolves fallback MOCK when terminal is not configured", async () => {
    const { service } = buildService({ terminals: [], settings: null });

    const result = await service.resolveCurrent(
      { tenantId, branchId },
      actor
    );

    assert.equal(result.source, "FALLBACK_MOCK");
    assert.equal(result.terminalId, "local-terminal");
    assert.equal(result.printerDeviceId, "mock-printer-001");
    assert.equal(result.features.printSale, true);
  });

  it("rejects branch from another tenant", async () => {
    const { service } = buildService({ branchExists: false });

    await assert.rejects(
      () =>
        service.createTerminal(
          {
            tenantId,
            branchId,
            code: "CAJA-02",
            name: "Caja 02",
          },
          actor
        ),
      /branchId does not belong to tenant/
    );
  });
});
