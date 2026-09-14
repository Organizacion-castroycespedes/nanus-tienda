## 1. API review contract

- [ ] 1.1 Add tenant-scoped customer and supplier review queue endpoints with permission guards.
- [ ] 1.2 Return missing fields, canonical location, fiscal status, review reason, and final-consumer exception classification.
- [ ] 1.3 Add API tests for queue membership, tenant isolation, filters, and final-consumer behavior.

## 2. Controlled fiscal editing

- [ ] 2.1 Centralize the currently evidenced person-type, tax-regime, and responsibility options.
- [ ] 2.2 Reject unsupported new fiscal values without assigning defaults.
- [ ] 2.3 Render controlled selectors in customer and supplier editors while preserving canonical geographic cascading.
- [ ] 2.4 Preserve manual source semantics and prevent claims of DIAN validation from the review workflow.

## 3. Web workflow and verification

- [ ] 3.1 Add the fiscal review page with entity, completeness, status, and missing-field filters.
- [ ] 3.2 Link rows to the existing customer/supplier edit flows and show loading, empty, and error states.
- [ ] 3.3 Run API/Web/Billing validation, OpenSpec strict validation, diff checks, and secret scan.
