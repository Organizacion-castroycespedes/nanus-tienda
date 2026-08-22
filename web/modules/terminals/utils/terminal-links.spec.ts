import assert from "node:assert/strict";
import test from "node:test";
import { buildTerminalPeripheralsPath } from "./terminal-links";

test("buildTerminalPeripheralsPath uses terminals.id and query param", () => {
  assert.equal(
    buildTerminalPeripheralsPath(
      "tenant-a",
      "693921eb-d28d-4c1b-af17-087b589c6467"
    ),
    "/tenant-a/admin/peripherals?terminalId=693921eb-d28d-4c1b-af17-087b589c6467"
  );
});

test("buildTerminalPeripheralsPath trims inputs", () => {
  assert.equal(
    buildTerminalPeripheralsPath(" tenant-a ", " term-001 "),
    "/tenant-a/admin/peripherals?terminalId=term-001"
  );
});
