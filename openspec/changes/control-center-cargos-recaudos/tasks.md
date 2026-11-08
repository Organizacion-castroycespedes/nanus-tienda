## 1. Prerrequisitos

- [x] 1.1 Confirmar con el propietario la ventana de anticipación (5 días) y los medios de pago (catálogo `payment_methods` del tenant plataforma).
- [x] 1.2 Crear una rama desde `develop` actualizado, registrar el ownership en `openspec-scope.json` y asignar el siguiente `V###` libre.

## 2. Base de datos

- [ ] 2.1 Crear `V113__control_center_charges_receipts.sql`: `charges`, `charge_lines`, `receipts`, `receipt_allocations`, `billing_runs`, índices únicos parciales, trigger de restricción diferido de sumas, inmutabilidad de líneas, reverso único de aplicaciones, secuencias, privilegios sin `DELETE` y `SELECT` por columnas en `payment_methods` y `financial_institutions`.
- [ ] 2.2 Crear el rollback protegido y la prueba de contrato SQL.
- [ ] 2.3 Aplicar en LOCAL y verificar con el rol dedicado: duplicados de período, sobreaplicación y reverso único.

## 3. API

- [ ] 3.1 Calculadora de períodos pura (prueba, corte a fin de mes, frecuencias, ítems únicos, terminación) con pruebas.
- [ ] 3.2 `BillingService.generateForContract` con bloqueo consultivo, idempotencia y auditoría; endpoint manual.
- [ ] 3.3 `ControlCenterBillingWorker` con bandera, intervalo, bitácora `billing_runs` y actor de sistema.
- [ ] 3.4 Prorrateo diario dentro de `ContractsService.amend`, con créditos aplicados automáticamente y anulación de cargos futuros, con pruebas de cálculo.
- [ ] 3.5 Catálogo `GET payment-methods` (medios del tenant plataforma con entidades) y validación de referencia y entidad.
- [ ] 3.6 Recaudos: registro con `Idempotency-Key`, comprobante validado (MIME, extensión, firma y tamaño), aplicación manual o automática, reverso y anulación con motivo.
- [ ] 3.7 Cargos: lista, detalle y anulación. Cartera: resumen por cuenta y tramos.
- [ ] 3.8 Pruebas `node:test` e inventario de guards actualizado.

## 4. Web

- [ ] 4.1 Pestaña Cartera: indicadores, cuentas por tramo, cargos y recaudos.
- [ ] 4.2 Registrar pago con selector de medio y entidad del catálogo, aplicación manual o automática y adjunto; descarga del comprobante.
- [ ] 4.3 Cargos y botón "Generar cargos" en la ficha del contrato; anulaciones y reversos con motivo.
- [ ] 4.4 Pruebas de formato y visibilidad.

## 5. Verificación

- [ ] 5.1 Pasar `openspec validate control-center-cargos-recaudos --strict` y la gobernanza en modo STRICT.
- [ ] 5.2 QA local: generación tras la prueba, renovación mensual con certificación anual, terminal adicional prorrateada, pago parcial, pago que cubre dos cargos, anulación con reverso y tramos de cartera.
- [ ] 5.3 Documentar la evidencia en `docs/evidencia-control-center-cargos-recaudos.md`.
