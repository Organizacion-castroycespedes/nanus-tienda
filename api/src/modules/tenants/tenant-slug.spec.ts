import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ensureUniqueTenantSlug,
  isReservedTenantSlug,
  resolveTenantSlugFromInput,
  slugifyTenantName,
} from "./tenant-slug";

test("slugifyTenantName strips accents and special chars", () => {
  assert.equal(slugifyTenantName("Almacén La 40"), "almacen-la-40");
  assert.equal(slugifyTenantName("Super Mercado José"), "super-mercado-jose");
  assert.equal(slugifyTenantName("Tienda & Café"), "tienda-cafe");
  assert.equal(
    slugifyTenantName("ManusTienda Platform S.A.S"),
    "manustienda-platform-s-a-s"
  );
});

test("slugifyTenantName collapses dashes and trims edges", () => {
  assert.equal(slugifyTenantName("  --Foo   Bar--  "), "foo-bar");
  assert.equal(slugifyTenantName("A___B"), "a-b");
});

test("ensureUniqueTenantSlug appends numeric suffixes", async () => {
  const taken = new Set(["tienda-central", "tienda-central-2"]);
  const result = await ensureUniqueTenantSlug("tienda-central", async (candidate) =>
    taken.has(candidate)
  );
  assert.equal(result, "tienda-central-3");
});

test("ensureUniqueTenantSlug returns base when free", async () => {
  const result = await ensureUniqueTenantSlug("libre", async () => false);
  assert.equal(result, "libre");
});

test("reserved slugs get a safe suffix", async () => {
  assert.equal(isReservedTenantSlug("login"), true);
  const result = await ensureUniqueTenantSlug("login", async (candidate) =>
    candidate === "login"
  );
  assert.equal(result, "login-tenant");
});

test("resolveTenantSlugFromInput prefers explicit slug then nombre", async () => {
  const fromExplicit = await resolveTenantSlugFromInput({
    explicitSlug: "Mi Tienda",
    nombre: "Otro",
    exists: async () => false,
  });
  assert.equal(fromExplicit, "mi-tienda");

  const fromNombre = await resolveTenantSlugFromInput({
    nombre: "Almacén La 40",
    exists: async () => false,
  });
  assert.equal(fromNombre, "almacen-la-40");
});

test("resolveTenantSlugFromInput rejects empty source", async () => {
  await assert.rejects(
    () =>
      resolveTenantSlugFromInput({
        exists: async () => false,
      }),
    /slug is required/
  );
});
