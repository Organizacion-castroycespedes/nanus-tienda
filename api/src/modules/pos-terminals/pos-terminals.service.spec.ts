import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { PosTerminalsService } from "./pos-terminals.service";
import { PeripheralConfigurationFacade } from "./peripheral-configuration.facade";
import type {
  OperationalTerminalRecord,
  PosTerminalPeripheralSettingsRecord,
  PosTerminalRecord,
} from "./pos-terminals.repository";

const tenantId = randomUUID();
const otherTenantId = randomUUID();
const branchId = randomUUID();
const otherBranchId = randomUUID();
const terminalId = randomUUID();
const operationalTerminalId = randomUUID();

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
  operational_terminal_id: null,
  operational_terminal_code: null,
  operational_terminal_name: null,
  operational_terminal_active: null,
  code: "local-terminal",
  name: "Terminal local",
  description: null,
  active: true,
  mode: "MOCK",
  created_at: "2026-06-05T00:00:00.000Z",
  updated_at: "2026-06-05T00:00:00.000Z",
  ...overrides,
});

const buildOperationalTerminal = (
  overrides: Partial<OperationalTerminalRecord> = {}
): OperationalTerminalRecord => ({
  id: operationalTerminalId,
  tenant_id: tenantId,
  branch_id: branchId,
  branch_name: "Sucursal Principal",
  code: "TERM-001",
  name: "Terminal 1 Sucursal Principal",
  is_active: true,
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
    operationalTerminals?: OperationalTerminalRecord[];
    settings?: PosTerminalPeripheralSettingsRecord | null;
    branchExists?: boolean;
    allowedBranchIds?: string[];
    failOnTextFindById?: boolean;
  } = {}
) => {
  const terminals = options.terminals ?? [buildTerminal()];
  const operationalTerminals = options.operationalTerminals ?? [];
  let settings = options.settings ?? buildSettings();
  const calls: string[] = [];
  const lookupCalls: string[] = [];
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const repository = {
    validateBranch: async () => options.branchExists ?? true,
    findPrincipalBranch: async () => ({
      id: branchId,
      tenant_id: tenantId,
      nombre: "Sucursal Principal",
    }),
    existsCodeInBranch: async () => false,
    findAll: async () => terminals,
    findById: async (id: string) => {
      lookupCalls.push(`findById:${id}`);
      if (options.failOnTextFindById && !uuidPattern.test(id)) {
        throw new Error(`invalid uuid lookup: ${id}`);
      }
      return terminals.find((terminal) => terminal.id === id) ?? null;
    },
    findByCode: async (_tenantId: string, _branchId: string, code: string) => {
      lookupCalls.push(`findByCode:${code}`);
      return terminals.find((terminal) => terminal.code === code) ?? null;
    },
    findOperationalTerminalById: async (id: string, requestedTenantId: string) => {
      lookupCalls.push(`findOperationalTerminalById:${id}`);
      return (
        operationalTerminals.find(
          (terminal) =>
            terminal.id === id && terminal.tenant_id === requestedTenantId
        ) ?? null
      );
    },
    findByOperationalTerminalId: async (
      requestedTenantId: string,
      requestedBranchId: string,
      requestedOperationalTerminalId: string
    ) => {
      lookupCalls.push(
        `findByOperationalTerminalId:${requestedOperationalTerminalId}`
      );
      return (
        terminals.find(
          (terminal) =>
            terminal.tenant_id === requestedTenantId &&
            terminal.branch_id === requestedBranchId &&
            terminal.operational_terminal_id === requestedOperationalTerminalId
        ) ?? null
      );
    },
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
  const allowedBranchIds = options.allowedBranchIds ?? [branchId];
  const accessControl = {
    getAccessibleBranchIds: async () => allowedBranchIds,
    canAccessBranch: async (
      _actor: unknown,
      _tenantId: string,
      requestedBranchId: string
    ) => allowedBranchIds.includes(requestedBranchId),
  };

  return {
    service: new PosTerminalsService(repository as any, accessControl as any),
    calls,
    lookupCalls,
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

  it("filters terminals to branches assigned to branch-scoped roles", async () => {
    const { service } = buildService({
      terminals: [
        buildTerminal(),
        buildTerminal({ id: randomUUID(), branch_id: otherBranchId }),
      ],
      allowedBranchIds: [branchId],
    });

    const result = await service.listTerminals({ tenantId }, actor);

    assert.equal(result.length, 1);
    assert.equal(result[0].branchId, branchId);
  });

  it("rejects a requested branch outside the actor scope", async () => {
    const { service } = buildService({
      terminals: [buildTerminal({ branch_id: otherBranchId })],
      allowedBranchIds: [branchId],
    });

    await assert.rejects(
      () => service.listTerminals({ tenantId, branchId: otherBranchId }, actor),
      /Branch scope mismatch/
    );
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

  it("allows clearing printer association with null", async () => {
    const { service } = buildService({
      settings: buildSettings({ printer_device_id: "network-printer-001" }),
    });

    const settings = await service.savePeripheralSettings(
      terminalId,
      {
        printerDeviceId: null,
      },
      actor
    );

    assert.equal(settings.printerDeviceId, null);
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

  it("resolves text terminalId as code without UUID lookup", async () => {
    const { service, lookupCalls } = buildService({
      failOnTextFindById: true,
    });

    const result = await service.resolveCurrent(
      { tenantId, branchId, terminalId: "local-terminal" },
      actor
    );

    assert.equal(result.source, "CONFIGURED");
    assert.equal(result.terminalId, "local-terminal");
    assert.deepEqual(lookupCalls, ["findByCode:local-terminal"]);
  });

  it("resolves TERM-001 through its linked HYBRID profile and XP-80", async () => {
    const xp80DeviceId = "usb-printer-1f0028d1fa5243c2";
    const { service, lookupCalls } = buildService({
      operationalTerminals: [buildOperationalTerminal()],
      terminals: [
        buildTerminal({
          code: "local-terminal",
          mode: "HYBRID",
          operational_terminal_id: operationalTerminalId,
          operational_terminal_code: "TERM-001",
          operational_terminal_name: "Terminal 1 Sucursal Principal",
          operational_terminal_active: true,
        }),
      ],
      settings: buildSettings({ printer_device_id: xp80DeviceId }),
    });

    const result = await service.resolveCurrent(
      { tenantId, branchId, terminalId: operationalTerminalId },
      actor
    );

    assert.equal(result.source, "CONFIGURED");
    assert.equal(result.operationalTerminalId, operationalTerminalId);
    assert.equal(result.operationalTerminalCode, "TERM-001");
    assert.equal(result.posTerminalId, terminalId);
    assert.equal(result.agentTerminalCode, "local-terminal");
    assert.equal(result.printerDeviceId, xp80DeviceId);
    assert.deepEqual(lookupCalls, [
      `findOperationalTerminalById:${operationalTerminalId}`,
      `findByOperationalTerminalId:${operationalTerminalId}`,
    ]);
  });

  it("returns TERM-002 as unconfigured without inheriting TERM-001 XP-80", async () => {
    const term002Id = randomUUID();
    const { service, lookupCalls } = buildService({
      operationalTerminals: [
        buildOperationalTerminal({ id: term002Id, code: "TERM-002" }),
      ],
      terminals: [buildTerminal()],
      settings: null,
    });

    const result = await service.resolveCurrent(
      { tenantId, branchId, terminalId: term002Id },
      actor
    );

    assert.equal(result.source, "OPERATIONAL_UNCONFIGURED");
    assert.equal(result.operationalTerminalId, term002Id);
    assert.equal(result.operationalTerminalCode, "TERM-002");
    assert.equal(result.posTerminalId, null);
    assert.equal(result.agentTerminalCode, null);
    assert.equal(result.printerDeviceId, null);
    assert.equal(result.terminalId, null);
    assert.deepEqual(lookupCalls, [
      `findOperationalTerminalById:${term002Id}`,
      `findByOperationalTerminalId:${term002Id}`,
    ]);
  });

  it("does not fall back to local-terminal for an unknown operational UUID", async () => {
    const unknownOperationalTerminalId = randomUUID();
    const { service, lookupCalls } = buildService({
      terminals: [buildTerminal({ code: "local-terminal", mode: "HYBRID" })],
    });

    await assert.rejects(
      () =>
        service.resolveCurrent(
          {
            tenantId,
            branchId,
            terminalId: unknownOperationalTerminalId,
          },
          actor
        ),
      /Operational terminal not found/
    );

    assert.deepEqual(lookupCalls, [
      `findOperationalTerminalById:${unknownOperationalTerminalId}`,
    ]);
  });

  it("does not resolve another tenant operational UUID through the local profile", async () => {
    const otherTenantOperationalTerminalId = randomUUID();
    const { service, lookupCalls } = buildService({
      operationalTerminals: [
        buildOperationalTerminal({
          id: otherTenantOperationalTerminalId,
          tenant_id: otherTenantId,
        }),
      ],
      terminals: [buildTerminal({ code: "local-terminal", mode: "HYBRID" })],
    });

    await assert.rejects(
      () =>
        service.resolveCurrent(
          {
            tenantId,
            branchId,
            terminalId: otherTenantOperationalTerminalId,
          },
          actor
        ),
      /Operational terminal not found/
    );

    assert.deepEqual(lookupCalls, [
      `findOperationalTerminalById:${otherTenantOperationalTerminalId}`,
    ]);
  });

  it("rejects an operational terminal from another branch", async () => {
    const { service } = buildService({
      operationalTerminals: [
        buildOperationalTerminal({ branch_id: otherBranchId }),
      ],
      allowedBranchIds: [branchId],
    });

    await assert.rejects(
      () =>
        service.resolveCurrent(
          { tenantId, terminalId: operationalTerminalId },
          actor
        ),
      /Branch scope mismatch/
    );
  });

  it("rejects a peripheral profile link outside its branch", async () => {
    const { service } = buildService({
      terminals: [],
      operationalTerminals: [
        buildOperationalTerminal({ branch_id: otherBranchId }),
      ],
    });

    await assert.rejects(
      () =>
        service.createTerminal(
          {
            tenantId,
            branchId,
            operationalTerminalId,
            code: "agent-term-001",
            name: "Perfil TERM-001",
            mode: "REAL",
          },
          actor
        ),
      /operationalTerminalId does not belong to POS terminal branch/
    );
  });

  it("rejects a peripheral profile link from another tenant", async () => {
    const { service } = buildService({
      terminals: [],
      operationalTerminals: [
        buildOperationalTerminal({ tenant_id: otherTenantId }),
      ],
    });

    await assert.rejects(
      () =>
        service.createTerminal(
          {
            tenantId,
            branchId,
            operationalTerminalId,
            code: "agent-term-001",
            name: "Perfil TERM-001",
            mode: "REAL",
          },
          actor
        ),
      /operationalTerminalId does not belong to tenant/
    );
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

  it("proves installer-to-POS handoff for network, USB, scanner and drawer", async () => {
    const { service } = buildService();
    const facade = new PeripheralConfigurationFacade(service);
    await facade.createPeripheralConfiguration(terminalId, {
      printerDeviceId: "network-qa",
      cashDrawerDeviceId: "drawer-qa",
      scannerDeviceId: "scanner-qa",
      enableScanner: true,
    }, actor);
    await facade.updatePeripheralConfiguration(terminalId, {
      printerDeviceId: "usb-qa",
    }, actor);
    await facade.assignPrinter(terminalId, "network-qa", actor);
    const posReload = await facade.getTerminalPeripheralConfiguration(terminalId, actor);
    assert.equal(posReload.printerDeviceId, "network-qa");
    assert.equal(posReload.cashDrawerDeviceId, "drawer-qa");
    assert.equal(posReload.scannerDeviceId, "scanner-qa");
  });

  it("proves post-install network edit and default reassignment preserve inventory", async () => {
    const { service } = buildService({
      settings: buildSettings({ printer_device_id: "printer-a" }),
    });
    const facade = new PeripheralConfigurationFacade(service);
    await facade.updatePeripheralConfiguration(terminalId, {
      printerDeviceId: "printer-b",
    }, actor);
    const reloaded = await facade.listTerminalPeripheralConfiguration(terminalId, actor);
    assert.equal(reloaded.printerDeviceId, "printer-b");
    await facade.updatePeripheralConfiguration(terminalId, {
      printerDeviceId: "printer-b",
    }, actor);
    assert.equal((await facade.getTerminalPeripheralConfiguration(terminalId, actor)).printerDeviceId, "printer-b");
  });

  it("updates drawer assignment without overwriting printer or scanner", async () => {
    const { service } = buildService({
      settings: buildSettings({
        printer_device_id: "printer-a",
        scanner_device_id: "scanner-a",
        cash_drawer_device_id: null,
      }),
    });
    const facade = new PeripheralConfigurationFacade(service);
    await facade.assignCashDrawer(terminalId, "drawer-qa", actor);
    const reloaded = await facade.getTerminalPeripheralConfiguration(terminalId, actor);
    assert.equal(reloaded.cashDrawerDeviceId, "drawer-qa");
    assert.equal(reloaded.printerDeviceId, "printer-a");
    assert.equal(reloaded.scannerDeviceId, "scanner-a");
  });
});
