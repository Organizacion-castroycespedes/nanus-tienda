import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import { ReportsController } from "./reports.controller";

test("ReportsController: health endpoint is public and does not require JWT", () => {
  assert.equal(Reflect.getMetadata("guards", ReportsController), undefined);
  assert.equal(Reflect.getMetadata("guards", ReportsController.prototype.getHealth), undefined);
});
