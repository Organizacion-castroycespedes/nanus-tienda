import { test } from "node:test";
import assert from "node:assert/strict";
import { FiscalProfileReviewService } from "./fiscal-profile-review.service";

test("fiscal review classifies incomplete normal records and final consumers separately", async () => {
  const db = {
    query: async () => ({
      rows: [
        {
          id: "customer-1", entity_type: "customer", name: "A", document_type: "CC", document_number: "123456",
          person_type: null, tax_regime: null, tax_responsibilities: [], fiscal_status: "PENDING", fiscal_data_source: "UNKNOWN",
          is_final_consumer: false, is_dian_validated: false, country_code: "CO", department_code: "05", municipality_code: "001",
          country_name: "Colombia", department_name: "Antioquia", municipality_name: "Medellín",
        },
        {
          id: "customer-final", entity_type: "customer", name: "Consumidor Final", document_type: null, document_number: null,
          person_type: null, tax_regime: null, tax_responsibilities: [], fiscal_status: "NOT_REQUIRED", fiscal_data_source: "MANUAL",
          is_final_consumer: true, is_dian_validated: false, country_code: null, department_code: null, municipality_code: null,
          country_name: null, department_name: null, municipality_name: null,
        },
      ],
    }),
  };
  const rows = await new FiscalProfileReviewService(db as never).list("tenant-1", "customer");
  assert.equal(rows[0].classification, "REQUIRES_HUMAN_FISCAL_REVIEW");
  assert.deepEqual(rows[0].missingFields, ["personType", "taxRegime", "taxResponsibilities"]);
  assert.equal(rows[1].classification, "FINAL_CONSUMER_EXCEPTION");
  assert.deepEqual(rows[1].missingFields, []);
});
