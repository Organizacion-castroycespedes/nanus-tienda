import assert from "node:assert/strict";
import test from "node:test";
import { resolvePosScaleUiState } from "./scale-visibility";

const configured = (
  overrides: Partial<{
    source: "CONFIGURED" | "FALLBACK_MOCK" | "OPERATIONAL_UNCONFIGURED";
    scaleDeviceId: string | null;
    features: { scale: boolean };
    scale: {
      assignment: "ASSIGNED" | "NONE";
      classification: "MOCK" | "UNKNOWN";
      deviceId: string | null;
    };
  }> = {}
) => ({
  source: "CONFIGURED" as const,
  scaleDeviceId: "scale-rochi-01",
  features: { scale: true },
  scale: {
    assignment: "ASSIGNED" as const,
    classification: "UNKNOWN" as const,
    deviceId: "scale-rochi-01",
  },
  ...overrides,
});

test("oculta la balanza cuando la configuración no está resuelta", () => {
  assert.equal(resolvePosScaleUiState(null), "unconfigured");
  assert.equal(resolvePosScaleUiState(undefined), "unconfigured");
});

test("oculta la balanza sin asignación o con enableScale deshabilitado", () => {
  assert.equal(resolvePosScaleUiState(configured({ scaleDeviceId: null })), "unconfigured");
  assert.equal(
    resolvePosScaleUiState(configured({ features: { scale: false } })),
    "unconfigured"
  );
  assert.equal(
    resolvePosScaleUiState(configured({ source: "FALLBACK_MOCK" })),
    "unconfigured"
  );
});

test("oculta una asignación CONFIGURED que usa el fixture MOCK documentado", () => {
  assert.equal(
    resolvePosScaleUiState(configured({ scaleDeviceId: "mock-scale-001" })),
    "unconfigured"
  );
});

test("permite mostrar la sección solo con asignación administrativa efectiva", () => {
  assert.equal(resolvePosScaleUiState(configured()), "configured");
});

test("oculta una asignacion sin vinculacion efectiva", () => {
  assert.equal(
    resolvePosScaleUiState(
      configured({
        scale: { assignment: "NONE", classification: "UNKNOWN", deviceId: null },
      })
    ),
    "unconfigured"
  );
});

test("oculta una respuesta incompatible entre ID y clasificacion", () => {
  assert.equal(
    resolvePosScaleUiState(
      configured({
        scale: {
          assignment: "ASSIGNED",
          classification: "UNKNOWN",
          deviceId: "otro-scale",
        },
      })
    ),
    "unconfigured"
  );
});
