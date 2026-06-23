# Evidencia QA - Caja requerida operaciones operativas

Fecha: 2026-06-22

## Casos

- [x] Backend bloquea mutacion operativa sin caja abierta.
- [x] Backend acepta mutacion operativa con caja abierta valida del usuario/tenant.
- [x] Backend rechaza caja abierta que no coincide con contexto POS.
- [x] Pedidos: create/update/deliver/confirm/invoice/cancel protegidos por caja abierta.
- [x] Compras: create/update/receive/cancel/settle-partial protegidos por caja abierta.
- [x] Ventas POS: create/cancel protegidos por caja abierta.
- [x] Pagos y movimientos de caja: create protegido por caja abierta.
- [x] UI pedidos: consulta queda visible y acciones operativas se bloquean sin caja.
- [x] UI compras: consulta/ticket quedan visibles y acciones operativas se bloquean sin caja.
- [x] Formularios de pago/facturacion exigen caja abierta para cualquier metodo de pago.
- [ ] QA manual USER sin caja abierta ve pedidos, pero no crea/paga/factura.
- [ ] QA manual API directa de pedido sin caja abierta queda bloqueada.
- [ ] QA manual USER sin caja abierta ve compras, pero no crea ni recibe productos.
- [ ] QA manual API directa de compra sin caja abierta queda bloqueada.
- [ ] QA manual USER sin caja abierta consulta domicilios.
- [ ] QA manual Domicilio con valor/recaudo sin caja abierta queda bloqueado.
- [ ] QA manual USER con caja abierta puede operar segun permisos.
- [ ] QA manual ADMIN/SUPER_USER mantienen consulta y requieren caja para mutaciones financieras.

## Validaciones

- [x] `cd api && npx.cmd tsx --test src\common\guards\jwt-auth.guard.spec.ts`
- [x] `cd api && npm.cmd run build`
- [x] `cd web && npm.cmd run lint`
- [x] `cd web && npm.cmd run build`
- [x] `openspec.cmd validate exigir-caja-abierta-operaciones-operativas --type change --strict`
- [x] `openspec.cmd validate --all --strict`
- [x] `git diff --check`

## Resultado

Validacion tecnica PASS. QA manual pendiente con usuario real sin caja y con caja abierta.

Notas:
- `npm.cmd run lint` y `npm.cmd run build` reportan warnings existentes de hooks/imagenes, sin fallo.
- No se modifico SQL.
- No se hizo commit.
