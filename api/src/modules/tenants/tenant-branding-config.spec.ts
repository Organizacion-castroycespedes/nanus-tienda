import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTenantBrandingConfig } from "./tenants.service";

test("keeps the new canonical logo and removes the legacy alias", () => {
  const normalized = normalizeTenantBrandingConfig({
    logo: "data:image/png;base64,new-logo",
    logoUrl: "data:image/png;base64,old-logo",
  });

  assert.equal(normalized.logo, "data:image/png;base64,new-logo");
  assert.equal("logoUrl" in normalized, false);
});

test("migrates a legacy logoUrl without retaining the alias", () => {
  const normalized = normalizeTenantBrandingConfig({
    logoUrl: "https://cdn.example.com/legacy-logo.png",
  });

  assert.equal(normalized.logo, "https://cdn.example.com/legacy-logo.png");
  assert.equal("logoUrl" in normalized, false);
});
