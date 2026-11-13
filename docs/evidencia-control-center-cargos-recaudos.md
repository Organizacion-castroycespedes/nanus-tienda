# Evidencia: MANUS Control Center, fase 2 (cargos, recaudos y cartera)

OpenSpec: `control-center-cargos-recaudos` · Rama: `feature/develop/control-center-cargos-recaudos` · Fecha: 2026-11-09

## Alcance

- Migración `V113__control_center_charges_receipts.sql` (SHA-256 `5f093ae0b4b32d3ddb669d0a4ca69e9131cf8315a382cb3942cd81c9c97a55ee`), su rollback protegido y su prueba de contrato.
- API:
  - Generación idempotente de cargos por período, con worker apagado por defecto y botón manual.
  - Prorrateo diario dentro de la enmienda.
  - Anulación de cargos futuros al enmendar o terminar.
  - Anulación de un contrato activo registrado por error.
  - Recaudos manuales con soporte, aplicación manual o automática, reversos, anulaciones y cartera por tramos.
- Web:
  - Pestaña **Cartera** (por cuenta, cargos y pagos) y formulario **Registrar pago**.
  - Detalle de cargo y de pago.
  - Sección **Cargos** y botón **Anular** en la ficha del contrato.
- Medios de pago tomados del catálogo existente `public.payment_methods` del tenant plataforma, más `public.financial_institutions`. El rol dedicado solo puede leer esas tablas, por columnas.

## Validación automatizada (Windows)

| Verificación | Resultado |
|---|---|
| `openspec validate control-center-cargos-recaudos --strict` | Válido |
| Gobernanza STRICT con los archivos cambiados frente a `develop` | `REPOSITORY_GATE_STATUS=PASS`, `STRICT_PASS` |
| API `tsc --noEmit` | OK |
| API pruebas del módulo `control-center` y guards | 140/140 |
| API suite completa (`npx tsx --test "src/**/*.spec.ts"`) | 1063 pasan, 2 omitidas, 0 fallas |
| Web pruebas `format.spec.ts` y `access.spec.ts` | 11/11 |
| Web lint | Sin advertencias ni errores |
| Web `tsc --noEmit` | 26 errores preexistentes en `*.spec.ts` ajenos; 0 fuera de specs |
| Contrato SQL V111 + V112 + V113 | 26 pruebas OK (3 omitidas sin bash en Windows; se ejecutan en CI) |

## Reglas verificadas en PostgreSQL 16 real

V111 a V113 se aplicaron sobre una base PostgreSQL 16 aislada. Con un usuario del rol `manus_control_center_app` se verificaron **39/39** reglas:

- Un solo cargo vigente por contrato, tipo, frecuencia e inicio de período (`uq_cc_charges_period`), y un solo prorrateo por versión.
- `base + impuesto = total`. Un cargo de valor cero solo puede quedar `PAID`. Un cargo con pagos no se puede anular.
- Montos de cargos y líneas inmutables (trigger y sin `UPDATE`). Sin `DELETE` ni `TRUNCATE` para el rol.
- Pago duplicado por cuenta, medio y referencia rechazado, sin distinguir mayúsculas ni espacios. La referencia vuelve a estar disponible si el pago se anula.
- Soporte con tipo MIME no permitido rechazado.
- Saldos verificados al confirmar mediante triggers diferidos:
  - Se rechaza una aplicación sin actualizar el saldo.
  - Se rechaza aplicar más que el saldo del cargo.
  - Se rechaza aplicar un pago a un cargo de otra cuenta.
- Dos aplicaciones concurrentes sobre el mismo cargo: una se confirma y la otra se rechaza.
- Reverso y anulación con motivo de al menos 10 caracteres. Una aplicación revertida y un pago anulado ya no se pueden modificar.
- El rol lee solo las columnas concedidas de `payment_methods` y `financial_institutions` y no puede escribir en ellas.
- El rollback se niega a borrar datos. Sin datos, revierte V113 y deja V112 intacta. V113 se puede reaplicar.

## Integración de servicios contra PostgreSQL real

Se ejecutaron los servicios de la API con el rol dedicado (sin HTTP) en tres escenarios:

1. **Flujo comercial completo:**
   - Cargo anual de $850.000 (base $714.286 + IVA $135.714) al terminar la prueba, sin duplicarse con el botón ni con el worker.
   - Validaciones de medio de pago: medio de crédito, medio de otro tenant, referencia obligatoria y entidad obligatoria.
   - Pago parcial con soporte PDF e `Idempotency-Key`.
   - Terminal adicional a mitad de año: $176.438 (184/365 días).
   - Retiro de la terminal: crédito de $88.219 aplicado al cargo más antiguo.
   - Pago automático a dos cargos con $461.781 de saldo a favor.
   - Anulación de pago con reverso, reverso único y reaplicación.
   - Tramos de cartera a una fecha.
2. **Cargos futuros pagados:** la enmienda y la terminación responden 409 hasta revertir el pago. Después, el cargo anticipado se anula y se regenera con la nueva versión ($1.200.000).
3. **Contrato registrado por error:** la terminación no aplica por tener versiones futuras. La anulación con motivo deja el contrato `CANCELLED`, libera el tenant y conserva el pago como saldo a favor. Con pagos aplicados responde 409.

## QA operativa del propietario (base local `manus_prd_local_test`)

V113 se aplicó directamente sobre la base local, con el mismo criterio que V111 y V112: sin runner gobernado ni registro en `migrations_history`. Privilegios del usuario `manus_cc_local`:

- Puede insertar en cargos y recaudos.
- No puede borrar cargos ni aplicaciones, ni editar líneas.
- Lee `nombre` de los medios de pago, pero no el código fiscal, y no puede editarlos.

El catálogo encontró 4 medios de pago del tenant plataforma (Débito, Efectivo, Transferencias y QR Bre-B) y 12 entidades financieras.

Recorrido del propietario:

1. `MCC-2026-00002` (fase 1) tenía 12 meses de prueba y versiones futuras, así que no generaba cargos. Se anuló como registrado por error y quedó `CANCELLED`.
2. Se creó `MCC-2026-00003`: inicio 08/10/2026, anual, prueba de 1 mes. **Generar cargos** creó `MCC-COB-2026-000001` (período 08/11/2026–07/11/2027, $850.000).
3. El pago `MCC-REC-2026-000002` ($450.000, registrado antes como saldo a favor) se aplicó al cargo. `MCC-REC-2026-000004` ($400.000) completó el pago y el cargo quedó **Pagado**.
4. `MCC-REC-2026-000001` ($850.000) se anuló con motivo.
5. Una enmienda con fecha dentro de la prueba (09/10/2026) se rechazó porque reemplazaría un cargo pagado. Con fecha 09/11/2026 se generó el prorrateo `MCC-COB-2026-000002` por **$349.041** (364/365 × $350.000), pendiente.
6. Las ejecuciones manuales repetidas no crearon duplicados.

**Nota:** el número `MCC-REC-2026-000003` no existe porque las secuencias de PostgreSQL no retroceden cuando una transacción falla (por ejemplo, un pago rechazado por validación). Es esperado.

## Pendiente para QA y PRD

- Aplicar V113 con el runner oficial en `manus_tienda_qa`, después de V111 y V112.
- Configurar en QA los medios de pago del tenant plataforma en Finanzas.
- Activar `CONTROL_CENTER_BILLING_WORKER_ENABLED=true` en QA, validar una ejecución automática y luego en PRD.
- Fase 3: alertas de vencimiento (aviso en el dashboard, correo y WhatsApp).
