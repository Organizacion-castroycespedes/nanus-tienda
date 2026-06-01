import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DianDocumentTypesController } from "./dian-document-types.controller";

describe("DianDocumentTypesController", () => {
  it("routes listActive to service", async () => {
    const service = {
      listActive: async () => [{ code: "31" }],
    };
    const controller = new DianDocumentTypesController(service as never);

    const result = await controller.listActive();

    assert.deepEqual(result, [{ code: "31" }]);
  });
});
