# Tareas

- [x] Normalizar controles de ubicación en CustomerForm.
- [x] Normalizar controles de ubicación en SupplierForm.
- [x] Hidratar selectores desde códigos canónicos.
- [x] Validar jerarquía fiscal en backend para clientes y proveedores.
- [ ] Agregar pruebas de UI automatizadas de cascada e hidratación.
- [ ] Revisar clasificación de campos fiscales con producto.
- [ ] Ejecutar suite completa y revisión QA.
# FactuCore fiscal response work

- [x] Expose proven fiscal metadata in status response.
- [x] Map CUFE and terminal metadata into Manus.
- [x] Persist safe provider response metadata without raw payload.
- [x] Cover terminal reconciliation without provider mutation.
- [x] Implement accepted electronic invoice representation and thermal rendering.
- [x] Guard non-accepted documents from accepted fiscal representation.
- [x] Preserve CUFE and available provider metadata without provider calls.
- [x] Add tenant-scoped sale electronic-document lookup and accepted-only reprint endpoint.
- [x] Implement typed automatic and on-demand billing request modes.
- [x] Reuse one eligibility and idempotent outbox request path for single and batch requests.
- [x] Hydrate sale billing status with one tenant-scoped reporting query.
- [x] Add on-demand single and multi-sale billing controls.
- [x] Add the backend-governed provider-create-intent recovery action to operational sale detail with confirmation, single-flight, and read-only refresh.
- [x] Keep FactuCore authentication/authorization failures technical, preserve HTTP evidence, and keep recovery audit action identifiers within the persisted schema limit.
- [x] Normalize zero-tax line treatments at the FactuCore boundary so `EXEMPT`/`EXCLUDED` lines omit incompatible provider taxes while durable Manus tax facts remain unchanged.
- [x] Keep Manus customer regimes separate from DIAN `PartyTaxScheme` and validate the code/name pair before XML generation.
- [x] Stop emitting the internal Manus product UUID as a DIAN standard item identifier.
- [x] Confirm the remaining FAZ09 product master-data gap; do not invent UNSPSC, GTIN, tariff, or contributor-standard values.
- [ ] Certify automatic/on-demand modes with a controlled E2E.
- [ ] Certify unattended/global worker operation.
- [x] Persist the authoritative signed-XML `sts:QRCode` during initial accepted processing without CUFE fallback.
- [x] Preserve idempotent QR metadata merge and fail-safe behavior when signed XML or QR is unavailable.

## Closure audit status

- [x] Product fiscal-field classification reviewed against the certified DIAN product flow.
- [x] Full relevant suite and QA evidence reviewed for the current delivery scope.
- [ ] On-demand end-to-end certification remains pending.
- [ ] Unattended/global worker certification remains pending.
