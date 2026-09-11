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
- [ ] Certify automatic/on-demand modes with a controlled E2E.
- [ ] Certify unattended/global worker operation.
