import assert from "node:assert/strict";
import test from "node:test";
import { formatTicketStatus } from "./status-label";

test("ticket status labels are human-readable", () => {
  assert.equal(formatTicketStatus("OPEN"), "Abierta");
  assert.equal(formatTicketStatus("CERRADA_PARCIAL"), "Cerrada parcial");
  assert.equal(formatTicketStatus("UNKNOWN_STATUS"), "UNKNOWN_STATUS");
});
