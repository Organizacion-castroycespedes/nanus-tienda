import assert from "node:assert/strict";
import test from "node:test";
import {
  sanitizeXss,
  sanitizeDocumentNumber,
  sanitizeEmail,
  validateStepCredentials,
  validateStepPersona,
  validateStepCargo,
  validateStepOrganization,
  validateStepRole,
} from "./validation";

test("sanitizeXss removes script tags and harmful characters", () => {
  const dirty = "  <script>alert('xss')</script> John <b>Doe</b> < >  ";
  const clean = sanitizeXss(dirty);
  assert.equal(clean, "John Doe");
});

test("sanitizeDocumentNumber strips non-alphanumerics and hyphens", () => {
  assert.equal(sanitizeDocumentNumber(" 10.234.567-8 "), "10234567-8");
  assert.equal(sanitizeDocumentNumber("pas-123 456"), "PAS-123456");
});

test("sanitizeEmail lowercases and trims", () => {
  assert.equal(sanitizeEmail(" USER@Example.COM "), "user@example.com");
});

test("validateStepCredentials checks email and password", () => {
  const invalidEmail = validateStepCredentials(
    { email: "invalid-email", password: "password123" },
    "create"
  );
  assert.equal(invalidEmail.isValid, false);
  assert.match(invalidEmail.error ?? "", /formato/i);

  const shortPass = validateStepCredentials(
    { email: "test@domain.com", password: "short" },
    "create"
  );
  assert.equal(shortPass.isValid, false);
  assert.match(shortPass.error ?? "", /8 caracteres/i);

  const valid = validateStepCredentials(
    { email: "test@domain.com", password: "password123" },
    "create"
  );
  assert.equal(valid.isValid, true);
});

test("validateStepPersona verifies names, document and optional fields", () => {
  const invalidName = validateStepPersona({
    nombres: "1234",
    apellidos: "Perez",
    documentoTipo: "CC",
    documentoNumero: "10203040",
  });
  assert.equal(invalidName.isValid, false);

  const invalidDoc = validateStepPersona({
    nombres: "Juan",
    apellidos: "Perez",
    documentoTipo: "CC",
    documentoNumero: "12", // too short
  });
  assert.equal(invalidDoc.isValid, false);

  const valid = validateStepPersona({
    nombres: "Juan Carlos",
    apellidos: "Pérez Gómez",
    documentoTipo: "CC",
    documentoNumero: "1020304050",
    telefono: "3001234567",
  });
  assert.equal(valid.isValid, true);
});

test("validateStepCargo checks title and limits", () => {
  assert.equal(
    validateStepCargo({ cargoNombre: "" }).isValid,
    false
  );
  assert.equal(
    validateStepCargo({ cargoNombre: "Cajero Principal" }).isValid,
    true
  );
});

test("validateStepOrganization checks tenant and branch", () => {
  assert.equal(
    validateStepOrganization({ tenantId: "", tenantBranchId: "branch-1" }, true).isValid,
    false
  );
  assert.equal(
    validateStepOrganization({ tenantId: "tenant-1", tenantBranchId: "branch-1" }, true).isValid,
    true
  );
  assert.equal(
    validateStepOrganization({ tenantBranchId: "branch-1" }, false).isValid,
    true
  );
});

test("validateStepRole checks roleId presence", () => {
  assert.equal(validateStepRole({ roleId: "" }).isValid, false);
  assert.equal(validateStepRole({ roleId: "role-1" }).isValid, true);
});
