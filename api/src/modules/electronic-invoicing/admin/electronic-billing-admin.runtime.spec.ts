import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import { Module, type ExecutionContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { DatabaseService } from "../../../common/db/database.service";
import { AccessControlService } from "../../../common/services/access-control.service";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { PermissionsGuard } from "../../../common/guards/permissions.guard";
import { BillingIntegrationClient } from "../../integration-outbox/services/billing-integration-client";
import { ElectronicBillingAdminController } from "./electronic-billing-admin.controller";
import { ElectronicBillingAdminService } from "./electronic-billing-admin.service";

const tenantId = "00000000-0000-4000-8000-000000000001";

@Module({
  controllers: [ElectronicBillingAdminController],
  providers: [
    ElectronicBillingAdminService,
    {
      provide: DatabaseService,
      useValue: {
        query: async () => ({ rows: [{ id: tenantId }] }),
      },
    },
    {
      provide: AccessControlService,
      useValue: {
        getPermissionsForRequest: async () => [],
        findPermission: () => undefined,
        isAccessAllowed: () => false,
        isActionAllowed: () => false,
      },
    },
    {
      provide: BillingIntegrationClient,
      useValue: {
        getElectronicBillingProviders: async () => ({
          providers: [{ id: "provider-1", code: "FACTUCORE", name: "FactuCore", active: true, capabilities: {} }],
        }),
        getTenantElectronicBillingConfiguration: async (requestedTenantId: string) => ({
          tenantId: requestedTenantId,
          configurations: [],
        }),
        getElectronicBillingRuntimeReadiness: async () => ({
          schemaMigration: "UNKNOWN",
          keyringStatus: "MISSING",
          syntheticSelfTest: "FAIL",
          historicalDecryptReady: "UNKNOWN",
          operationalOwnership: "UNKNOWN",
          recoveryReadiness: "UNKNOWN",
          credentialWrites: "DISABLED",
          writeReady: false,
        }),
      },
    },
  ],
})
class ElectronicBillingAdminRuntimeTestModule {}

const contextForRoles = (roles: string[]): ExecutionContext =>
  ({
    getHandler: () => () => undefined,
    getClass: () => ElectronicBillingAdminController,
    switchToHttp: () => ({ getRequest: () => ({ user: { roles } }) }),
  }) as unknown as ExecutionContext;

test("real Nest module injects admin service and keeps route authorization", async () => {
  const app = await NestFactory.createApplicationContext(
    ElectronicBillingAdminRuntimeTestModule,
    { logger: false },
  );

  try {
    const controller = app.get(ElectronicBillingAdminController);
    assert.ok(controller);
    assert.ok(Reflect.get(controller, "service"));

    const providers = await controller.listProviders();
    assert.equal(providers.providers[0]?.code, "FACTUCORE");

    const configuration = await controller.getTenantConfiguration(tenantId);
    assert.equal(configuration.tenantId, tenantId);

    const readiness = await controller.getRuntimeCryptoReadiness();
    assert.equal(readiness.writeReady, false);

    assert.deepEqual(
      Reflect.getMetadata("roles", ElectronicBillingAdminController),
      ["SUPER_ADMIN"],
    );
    assert.deepEqual(
      Reflect.getMetadata(GUARDS_METADATA, ElectronicBillingAdminController),
      [JwtAuthGuard, RolesGuard, PermissionsGuard],
    );

    const rolesGuard = new RolesGuard(new Reflector());
    assert.equal(rolesGuard.canActivate(contextForRoles(["SUPER_ADMIN"])), true);
    for (const role of ["ADMIN", "SUPER_USER", "USER"]) {
      assert.equal(rolesGuard.canActivate(contextForRoles([role])), false);
    }
  } finally {
    await app.close();
  }
});

test("permission guard denies non-SUPER_ADMIN without registered provider permission", async () => {
  const guard = new PermissionsGuard(new Reflector(), {
    getPermissionsForRequest: async () => [],
    findPermission: () => undefined,
    isAccessAllowed: () => false,
    isActionAllowed: () => false,
  } as unknown as AccessControlService);
  const context = {
    getHandler: () => ElectronicBillingAdminController.prototype.listProviders,
    getClass: () => ElectronicBillingAdminController,
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: "user-1", tenantId, roles: ["ADMIN"] } }),
    }),
  } as unknown as ExecutionContext;

  await assert.rejects(() => guard.canActivate(context), /Permisos insuficientes/);
});

test("JWT guard rejects missing bearer token before any database access", async () => {
  const guard = new JwtAuthGuard({
    query: async () => {
      throw new Error("database must not be queried");
    },
  } as unknown as DatabaseService);
  const context = {
    getHandler: () => ElectronicBillingAdminController.prototype.listProviders,
    getClass: () => ElectronicBillingAdminController,
    switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
  } as unknown as ExecutionContext;

  await assert.rejects(() => guard.canActivate(context), /Token requerido/);
});
