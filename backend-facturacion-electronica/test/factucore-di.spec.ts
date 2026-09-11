import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { ElectronicBillingProviderRegistry } from "../src/modules/electronic-billing/providers/electronic-billing-provider-registry";
import { FactuCoreProvider } from "../src/modules/electronic-billing/providers/factucore/factucore.provider";
import { FactuCoreClient } from "../src/modules/electronic-billing/providers/factucore/factucore.client";
import { test } from "node:test";
import assert from "node:assert/strict";

test("Nest runtime wires FactuCore provider dependencies", async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const provider = app.get(FactuCoreProvider);
    const client = app.get(FactuCoreClient, { strict: false });
    const registry = app.get(ElectronicBillingProviderRegistry);

    assert.ok(client);
    assert.ok((provider as unknown as { client?: unknown }).client);
    assert.ok((provider as unknown as { credentialResolver?: unknown }).credentialResolver);
    assert.ok((provider as unknown as { mapper?: unknown }).mapper);
    assert.equal(registry.has("FACTUCORE"), true);
  } finally {
    await app.close();
  }
});
