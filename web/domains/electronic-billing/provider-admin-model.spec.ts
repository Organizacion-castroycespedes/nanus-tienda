import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getRoutePermissionRequirement } from "../../lib/route-permissions";
import { MENU_KEYS } from "../menu/constants";
import {
  isSafeProviderPayload,
  normalizeProviderCode,
  safeCapabilityKeys,
} from "./provider-admin-model";

test("provider route requires the electronic billing menu permission", () => {
  assert.deepEqual(
    getRoutePermissionRequirement("/acme/configuracion/facturacion-electronica/proveedores"),
    { module: MENU_KEYS.ELECTRONIC_BILLING_PROVIDERS, action: "read" },
  );
});

test("provider UI normalizes code and rejects sensitive payload fields", () => {
  assert.equal(normalizeProviderCode(" factucore "), "FACTUCORE");
  assert.equal(isSafeProviderPayload({ code: "FACTUCORE", name: "FactuCore" }), true);
  assert.equal(isSafeProviderPayload({ name: "FactuCore", clientSecret: "hidden" }), false);
  assert.deepEqual(safeCapabilityKeys({ invoice: true, clientSecret: true, pdf: false }), ["invoice"]);
});

test("tenant activation uses the Manus confirmation dialog and never native confirm", () => {
  const source = readFileSync(
    join(process.cwd(), "domains", "electronic-billing", "TenantElectronicBillingReadOnly.tsx"),
    "utf8",
  );

  assert.match(source, /ConfirmDialog/);
  assert.match(source, /Confirmar activaci/);
  assert.match(source, /setActivationTarget\(configuration\)/);
  assert.doesNotMatch(source, /window\.confirm/);
});
