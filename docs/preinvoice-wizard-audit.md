# Auditoría Previa — Wizard de Facturación de Ventas

**Fecha:** 2026-09-24  
**Contexto:** `feat/develop/cajas-arqueos`  
**Referencia:** [prompt_wizard_facturacion_cliente_pagos_caja.md](file:///l:/Proyectos/sociedad/nanus-tienda/docs/prompt_wizard_facturacion_cliente_pagos_caja.md)

---

## 1. Handler actual del botón `Facturar`

- En [OperationalSalesPage.tsx](file:///l:/Proyectos/sociedad/nanus-tienda/web/modules/operational-sales/components/OperationalSalesPage.tsx#L205):
  ```tsx
  <Button
    variant="outline"
    size="sm"
    onClick={() => void handleBillingRequest(sale.id)}
    disabled={actionSaleId === sale.id}
  >
    {actionSaleId === sale.id ? "Solicitando..." : "Facturar"}
  </Button>
  ```
- En [OperationalSaleDetailPage.tsx](file:///l:/Proyectos/sociedad/nanus-tienda/web/modules/operational-sales/components/OperationalSaleDetailPage.tsx#L168-L181):
  ```tsx
  <Button
    variant="outline"
    onClick={() => {
      if (window.confirm(
        `¿Facturar electrónicamente esta venta usando el cliente ${sale.customer.name ?? sale.customer.id}? Se validarán sus datos fiscales antes de crear la solicitud.`
      )) {
        void onRequestBilling();
      }
    }}
    disabled={refreshLoading}
  >
    {refreshLoading ? "Solicitando FE..." : "Facturar electrónicamente"}
  </Button>
  ```
- Ambos handlers llaman directamente la solicitud de facturación sin dar paso previo de revisión de cliente o pagos.

---

## 2. Función / Hook / Servicio que ejecuta la facturación

- En [operational-sales.service.ts](file:///l:/Proyectos/sociedad/nanus-tienda/web/modules/operational-sales/services/operational-sales.service.ts#L66-L70):
  ```ts
  export const requestOperationalSaleElectronicBilling = (saleId: string) =>
    apiClient<ElectronicBillingRequestResult>(
      `/sales/${encodeURIComponent(saleId)}/electronic-billing`,
      { method: "POST", includePosSession: true },
    );
  ```
- En [use-operational-sale-detail.ts](file:///l:/Proyectos/sociedad/nanus-tienda/web/modules/operational-sales/hooks/use-operational-sale-detail.ts#L33-L45):
  Llama `requestOperationalSaleElectronicBilling(saleId)` y luego `reload()`.

---

## 3. Endpoint actual

- En [sale.controller.ts](file:///l:/Proyectos/sociedad/nanus-tienda/api/src/modules/inventory/controllers/sale.controller.ts#L142-L146):
  ```ts
  @Post(":id/electronic-billing")
  @RequirePermission({ menuKey: "POS", level: "WRITE", operationalRoles: ["USER"] })
  requestElectronicBilling(@Param("id") id: string, @Req() request: AuthRequest) {
    return this.saleService.requestElectronicBillingForSale(id, this.buildActor(request));
  }
  ```
- No duplica venta ni afecta inventario ni exige caja abierta para facturar. Solo crea el evento de integración outbox (`SALE_COMPLETED_FOR_ELECTRONIC_BILLING`).

---

## 4. Componente de cliente usado en `Cobrar venta`

- En [CustomerSection.tsx](file:///l:/Proyectos/sociedad/nanus-tienda/web/modules/pos/components/payment/CustomerSection.tsx):
  Muestra cliente actual, dropdown de búsqueda de cliente y botón para abrir creación/edición fiscal rápida.
- En [QuickFiscalCustomerModal.tsx](file:///l:/Proyectos/sociedad/nanus-tienda/web/modules/pos/components/QuickFiscalCustomerModal.tsx):
  Modal para ingresar o completar datos fiscales (tipo documento, número, nombre/razón social, régimen, responsabilidades fiscales, municipio, departamento, correo).

---

## 5. Componente de medios de pago

- En [PaymentDialog.tsx](file:///l:/Proyectos/sociedad/nanus-tienda/web/modules/pos/components/payment/PaymentDialog.tsx):
  Soporta múltiples métodos de pago, cálculo de totales, montos ingresados y cambio.
- En [FinancialInstitutionSelector.tsx](file:///l:/Proyectos/sociedad/nanus-tienda/web/modules/pos/components/payment/FinancialInstitutionSelector.tsx):
  Selector de banco o billetera digital para métodos bancarizados.

---

## 6. Reglas de referencia

- En [pos-payment-rules.ts](file:///l:/Proyectos/sociedad/nanus-tienda/web/modules/pos/utils/pos-payment-rules.ts):
  - `getRequiresReferenceForPos(method)`: exige referencia para transferencias, tarjetas, códigos QR, etc.
  - `getRequiresFinancialInstitutionForPos(method)`: exige entidad financiera para pagos bancarios.

---

## 7. Pagos múltiples

- En la tabla `payments` ([20260430_1947_finance_payments_engine.sql](file:///l:/Proyectos/sociedad/nanus-tienda/scripts/database/finance/migrations/20260430_1947_finance_payments_engine.sql#L16)):
  Cada pago se almacena como una fila independiente con:
  - `id`, `tenant_id`, `branch_id`, `payment_method_id`, `cash_session_id`, `reference_type` (`'SALE'`), `reference_id` (`sale.id`), `amount`, `reference_number`, `financial_institution_id`, `status` (`'COMPLETED'`).
  - Una venta puede tener N pagos vinculados.

---

## 8. Caja activa

- En frontend: [finance.service.ts](file:///l:/Proyectos/sociedad/nanus-tienda/web/modules/finance/services/finance.service.ts#L143) invoca `GET /finance/cash-sessions/current`.
- En backend: [cash-sessions.service.ts](file:///l:/Proyectos/sociedad/nanus-tienda/api/src/modules/finance/cash-sessions/cash-sessions.service.ts#L1521) busca la sesión en estado `OPEN` para la sucursal y usuario.

---

## 9. Turno / Jornada activa

- El turno está enlazado a la sesión de caja activa (`cash_sessions` con `status = 'OPEN'`, `opened_at`, `user_id`).

---

## 10. Movimientos de caja y arqueo

- En [cash-sessions.service.ts](file:///l:/Proyectos/sociedad/nanus-tienda/api/src/modules/finance/cash-sessions/cash-sessions.service.ts#L588-L612):
  Los arqueos y el saldo esperado de caja se calculan consultando directamente `payments` donde `payment.cash_session_id = currentSession.id` y `payment.status IN ('PENDING', 'COMPLETED')`.
- Si se modifica un pago histórico de una sesión ya cerrada, no se debe alterar la sesión cerrada, sino registrar un movimiento o ajuste en la sesión abierta actual.

---

## 11. Relación pago ↔ venta

- Venta (`sales`): almacena `total`, `balance`, `payment_status` (`PAID`, `PARTIAL`, `PENDING`), `total_paid`, `balance_due`.
- Pagos (`payments`): `reference_type = 'SALE'` y `reference_id = sale.id`.
- Detalle en [OperationalSalesRepository.ts](file:///l:/Proyectos/sociedad/nanus-tienda/api/src/modules/operational-sales/operational-sales.repository.ts#L168-L188) carga todos los pagos asociados a la venta.

---

## 12. Permisos

- Facturación actual requiere: `@RequirePermission({ menuKey: "POS", level: "WRITE", operationalRoles: ["USER"] })`.
- Edición de medios de pago requiere nivel `WRITE` en `POS` o `OPERATIONS_SALES`.

---

## 13. Auditoría existente

- Servicio [security-audit-logs.service.ts](file:///l:/Proyectos/sociedad/nanus-tienda/api/src/modules/security/services/security-audit-logs.service.ts) y tabla `security_audit_logs`.
- Guarda `module`, `entity`, `entityId`, `action`, `before`, `after`, `reason`, `userId`, `tenantId`.

---

## 14. Comportamiento de Consumidor Final

- En [sale.service.ts](file:///l:/Proyectos/sociedad/nanus-tienda/api/src/modules/inventory/services/sale.service.ts#L852-L910) y [electronic-billing-eligibility.ts](file:///l:/Proyectos/sociedad/nanus-tienda/api/src/modules/integration-outbox/contracts/electronic-billing-eligibility.ts#L26-L31):
  Si el cliente es Consumidor Final y la venta tiene impuestos pero faltan datos fiscales completos, la validación DIAN rechaza (`INCOMPLETE_CUSTOMER_FISCAL_DATA`).
- El Paso 1 del wizard permite reemplazar a Consumidor Final por un cliente fiscal antes de emitir la factura.

---

## 15. Lógica de Factucore / DIAN

- Evaluada en `requestElectronicBillingForSaleInTransaction` de [sale.service.ts](file:///l:/Proyectos/sociedad/nanus-tienda/api/src/modules/inventory/services/sale.service.ts#L1425).
- Requiere venta en estado `CONFIRMED` y `PAID`.
- Al facturar se encola un evento Outbox que el worker procesa hacia Factucore/DIAN.
- Facturar NO requiere caja abierta. Corregir pagos SÍ puede requerir caja abierta.
