import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DianDocumentTypesService } from "./dian-document-types.service";

describe("DianDocumentTypesService", () => {
  it("lists active document types from repository", async () => {
    const repository = {
      findActive: async () => [
        {
          id: "type-31",
          code: "31",
          name: "NIT",
          description: null,
          countryCode: "CO",
          isActive: true,
          validFrom: null,
          validTo: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    };
    const service = new DianDocumentTypesService(repository as never);

    const result = await service.listActive();

    assert.equal(result.length, 1);
    assert.equal(result[0].code, "31");
  });

  it("returns empty array when catalog table has no active rows", async () => {
    const repository = {
      findActive: async () => [],
    };
    const service = new DianDocumentTypesService(repository as never);

    const result = await service.listActive();

    assert.deepEqual(result, []);
  });
});
