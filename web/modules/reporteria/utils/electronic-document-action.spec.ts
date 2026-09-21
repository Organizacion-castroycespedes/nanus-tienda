import test from "node:test";
import assert from "node:assert/strict";
import { canViewElectronicDocument } from "./electronic-document-action";

test("electronic document action only allows accepted DIAN status", () => {
  assert.equal(canViewElectronicDocument("ACCEPTED"), true);
  for (const status of ["PENDING", "PROCESSING", "REQUESTED", "REJECTED", "TECHNICAL_ERROR", "NO_DOCUMENT"] as const) {
    assert.equal(canViewElectronicDocument(status), false, status);
  }
});
