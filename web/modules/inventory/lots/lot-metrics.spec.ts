import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeLotMetrics,
  daysUntil,
  isLotSellable,
  type LotMetricRow,
} from "./lot-metrics";

const today = new Date("2026-11-13T10:00:00");

const row = (
  id: string,
  status: LotMetricRow["lot"]["status"],
  expirationDate: string | null,
  available: number | null
): LotMetricRow => ({
  lot: { id, status, expirationDate },
  balance: available === null ? null : { quantityAvailable: available },
});

describe("lot-metrics", () => {
  it("calcula días hasta el vencimiento", () => {
    assert.equal(daysUntil("2026-11-13", today), 0);
    assert.equal(daysUntil("2026-11-12", today), -1);
    assert.equal(daysUntil("2026-12-13", today), 30);
    assert.equal(daysUntil(null, today), null);
  });

  it("vendible solo si ACTIVE y no vencido, igual que la venta", () => {
    assert.equal(isLotSellable({ id: "a", status: "ACTIVE", expirationDate: null }, today), true);
    assert.equal(isLotSellable({ id: "a", status: "ACTIVE", expirationDate: "2026-11-13" }, today), true);
    assert.equal(isLotSellable({ id: "a", status: "ACTIVE", expirationDate: "2026-11-12" }, today), false);
    assert.equal(isLotSellable({ id: "a", status: "BLOCKED", expirationDate: null }, today), false);
  });

  it("lote ACTIVE vencido ayer con 5 disponibles suma a no vendible", () => {
    const metrics = computeLotMetrics([row("l1", "ACTIVE", "2026-11-12", 5)], today);
    assert.equal(metrics.sellableAvailable, 0);
    assert.equal(metrics.nonSellableAvailable, 5);
    assert.equal(metrics.nonSellableBreakdown.expired, 5);
    assert.equal(metrics.expiredLots, 1);
  });

  it("no vendible = vencido 5 + bloqueado 3", () => {
    const metrics = computeLotMetrics(
      [row("l1", "ACTIVE", "2026-11-01", 5), row("l2", "BLOCKED", null, 3), row("l3", "ACTIVE", null, 7)],
      today
    );
    assert.equal(metrics.nonSellableAvailable, 8);
    assert.equal(metrics.nonSellableBreakdown.blocked, 3);
    assert.equal(metrics.sellableAvailable, 7);
  });

  it("cuenta lotes distintos aunque tengan varias filas de saldo", () => {
    const metrics = computeLotMetrics(
      [row("l1", "ACTIVE", "2026-11-20", 2), row("l1", "ACTIVE", "2026-11-20", 3), row("l2", "ACTIVE", null, null)],
      today
    );
    assert.equal(metrics.activeLots, 2);
    assert.equal(metrics.expiringLots, 1);
    assert.equal(metrics.sellableAvailable, 5);
  });

  it("el alcance es el del conjunto recibido (búsqueda reduce indicadores)", () => {
    const all = Array.from({ length: 10 }, (_, index) => row(`l${index}`, "ACTIVE", null, 1));
    assert.equal(computeLotMetrics(all, today).activeLots, 10);
    assert.equal(computeLotMetrics(all.slice(0, 2), today).activeLots, 2);
  });
});
