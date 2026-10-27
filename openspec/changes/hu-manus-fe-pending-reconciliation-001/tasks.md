## 1. Contrato y mapeo P0

- [x] 1.1 Tipar `reusedExisting` y conservar `queued`, `reusedExisting`, `reason` y la marca derivada de reconciliación en metadatos.
- [x] 1.2 Implementar un predicado estricto y reutilizable para `SIGNED/PENDING/PENDING_RECONCILIATION`.
- [x] 1.3 Probar precedencia `status`/`providerStatus`, ignorar `normalizedStatus` contradictorio y cubrir pendiente, `ACCEPTED` contractual, `ACCEPTED/fiscalFinal=false`, `SENT/PENDING/TEST_SET_ACCEPTED/fiscalFinal=false`, código `2`, CUFE no confiable y respuesta malformada.

## 2. Guardas contra retransmisión P0

- [x] 2.1 Hacer que el provider FactuCore retorne la consulta pendiente sin ejecutar `POST /transmit`.
- [x] 2.2 Evitar la etapa `TRANSMITTED` ante `queued=false` y `reusedExisting=true` en carreras de transmisión de `resumeInvoice` y `issueCreditNote` queued.
- [x] 2.3 Hacer que refresh y recuperación ligada persistan pendiente y no llamen `resumeInvoice`.
- [x] 2.4 Exponer retryability `RECONCILE_ONLY`/`RECONCILE_PROVIDER` para reconciliación requerida.

## 3. Pruebas P0

- [x] 3.1 Probar issue `201` pendiente, cinco ciclos sin transmit y reinicio `PROCESSING`.
- [x] 3.2 Probar concurrencia worker/recuperación, respuesta reutilizada en factura y nota crédito queued, e idempotencia por `externalReference`.
- [x] 3.3 Probar aislamiento de dos tenants, `ACCEPTED` contractual, rechazo de aceptación auxiliar sin estado terminal, `REJECTED`, `SENT/TEST_SET_ACCEPTED`, cinco ciclos y reinicio con cero `resumeInvoice` y cero `POST /transmit`.
- [x] 3.4 Confirmar que correo `502` permanece separado del estado fiscal mediante regresión existente o prueba focalizada.
- [x] 3.5 Reemplazar el fake de reinicio por la forma wire exacta de GET detail y probar issue sync/queued, GET status y POST transmit sin depender de campos ausentes.

## 4. Validación

- [x] 4.1 Ejecutar pruebas focalizadas y regresiones pertinentes sin servicios externos ni BD real.
- [x] 4.2 Ejecutar typecheck, lint disponible, build y `openspec validate --strict`.
- [x] 4.3 Ejecutar `git diff --check` y revisar que no existan migraciones ni cambios de contratos públicos.
- [x] 4.4 Verificar read-only el contrato P0 local de FactuCore y ejecutar su prueba contractual aislada sin servicios desplegados.

## 5. Mejoras P1 no bloqueantes

- [ ] 5.1 Definir alertas y umbral operativo para reconciliaciones pendientes prolongadas.
- [ ] 5.2 Evaluar elevar `queued` y `reusedExisting` a DTO público mediante cambio contractual separado.
- [ ] 5.3 Validar en integración coordinada la evidencia CUFE/CUDE y códigos DIAN; MANUS no debe asumir esa responsabilidad fiscal.
