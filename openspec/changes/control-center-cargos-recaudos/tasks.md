## 1. Prerrequisitos

- [x] 1.1 Confirmar con el propietario la ventana de anticipación (5 días) y los medios de pago (catálogo `payment_methods` del tenant plataforma).
- [x] 1.2 Crear una rama desde `develop` actualizado, registrar el ownership en `openspec-scope.json` y asignar el siguiente `V###` libre.

## 2. Base de datos

- [x] 2.1 Crear `V113__control_center_charges_receipts.sql`: `charges`, `charge_lines`, `receipts`, `receipt_allocations`, `billing_runs`, índices únicos parciales, trigger de restricción diferido de sumas, inmutabilidad de líneas, reverso único de aplicaciones, secuencias, privilegios sin `DELETE` y `SELECT` por columnas en `payment_methods` y `financial_institutions`.
- [x] 2.2 Crear el rollback protegido y la prueba de contrato SQL.
- [x] 2.3 Aplicar en LOCAL y verificar con el rol dedicado: duplicados de período, sobreaplicación y reverso único.

## 3. API

- [x] 3.1 Calculadora de períodos pura (prueba, corte a fin de mes, frecuencias, ítems únicos, terminación) con pruebas.
- [x] 3.2 `BillingService.generateForContract` con bloqueo consultivo, idempotencia y auditoría; endpoint manual.
- [x] 3.3 `ControlCenterBillingWorker` con bandera, intervalo, bitácora `billing_runs` y actor de sistema.
- [x] 3.4 Prorrateo diario dentro de `ContractsService.amend`, con créditos aplicados automáticamente y anulación de cargos futuros, con pruebas de cálculo.
- [x] 3.5 Catálogo `GET payment-methods` (medios del tenant plataforma con entidades) y validación de referencia y entidad.
- [x] 3.6 Recaudos: registro con `Idempotency-Key`, comprobante validado (MIME, extensión, firma y tamaño), aplicación manual o automática, reverso y anulación con motivo.
- [x] 3.7 Cargos: lista, detalle y anulación. Cartera: resumen por cuenta y tramos.
- [x] 3.9 Anulación de contrato activo registrado por error (`POST contracts/:id/void`).
- [x] 3.8 Pruebas `node:test` e inventario de guards actualizado.

## 4. Web

- [x] 4.1 Pestaña Cartera: indicadores, cuentas por tramo, cargos y recaudos.
- [x] 4.2 Registrar pago con selector de medio y entidad del catálogo, aplicación manual o automática y adjunto; descarga del comprobante.
- [x] 4.3 Cargos y botón "Generar cargos" en la ficha del contrato; anulaciones y reversos con motivo.
- [x] 4.5 Botón "Anular contrato" en la ficha con motivo obligatorio.
- [x] 4.4 Pruebas de formato y visibilidad.

## 5. Verificación

- [x] 5.1 Pasar `openspec validate control-center-cargos-recaudos --strict` y la gobernanza en modo STRICT.
- [x] 5.2 QA local: generación tras la prueba, renovación mensual con certificación anual, terminal adicional prorrateada, pago parcial, pago que cubre dos cargos, anulación con reverso y tramos de cartera.
- [x] 5.3 Documentar la evidencia en `docs/evidencia-control-center-cargos-recaudos.md`.
