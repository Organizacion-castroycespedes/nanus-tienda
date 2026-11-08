## 1. Prerrequisitos

- [x] 1.1 Confirmar que `habilitar-plataforma-control-center` está implementado en el target.
- [x] 1.2 Resolver con el propietario IVA (incluido, desde `taxes` del tenant plataforma), certificación ($119.000/año), prueba (1 mes) y corte (día de inicio).
- [x] 1.2b Certificación incluida en el año inicial (ítem `CERTIFICATION` con descuento del 100%).
- [x] 1.2c Verificar que el tenant plataforma tenga configurado en `public.taxes` el IVA 19% con `is_included=true` en QA y PRD.
- [x] 1.3 Decisión: no se usa `btree_gist`; la no superposición de vigencias se garantiza con una sola versión abierta por plan y vigencias crecientes (ver design D1).
- [x] 1.4 Registrar el ownership en `openspec-scope.json` y asignar el siguiente `V###` libre.

## 2. Base de datos

- [x] 2.1 Crear `V###__control_center_accounts_contracts.sql` con las tablas, constraints, índices únicos parciales, triggers de inmutabilidad (`contract_versions`, `contract_items`, `plan_price_versions`, `plan_price_components`), `idempotency_keys` y la secuencia de `contract_number`.
- [x] 2.2 Crear el rollback correspondiente.
- [ ] 2.3 Dry-run en LOCAL, aplicación en LOCAL y diagnóstico de gobernanza en modo STRICT. Estado 2026-11-08: gobernanza STRICT PASS; V112 aplicada directamente en `manus_prd_local_test` (mismo criterio que V111) y 25 reglas verificadas con el rol dedicado en transacción revertida. Runner oficial pendiente para QA.
- [x] 2.4 Agregar pruebas SQL de constraints: un vínculo activo por tenant, un contrato vigente por tenant, inmutabilidad y FK `RESTRICT` a `public.tenants`.

## 3. API

- [x] 3.1 Directorio de tenants (repository con el pool dedicado, keyset y estado de terminales).
- [x] 3.2 Cuentas comerciales y vínculos (servicio, DTO y auditoría).
- [x] 3.3 Catálogo de planes y versiones de precio (sin solapes, motivo obligatorio).
- [x] 3.4 Contratos: creación con snapshot e idempotencia, activación con locks, enmienda, terminación y cancelación.
- [x] 3.5 Pruebas `node:test` (102 del módulo): parsers, montos decimales e IVA, fechas, construcción de ítems (snapshot, bonos de certificación, ajustes), cursor e inventario de guards de los 5 controllers. La exclusión de dos contratos abiertos por tenant (base de la concurrencia de activación) la garantiza el índice único parcial y se verificó en PostgreSQL real.

## 4. Web

- [ ] 4.1 Pantallas de directorio, cuentas, planes y contratos (asistente y detalle con historial).
- [ ] 4.2 Formularios con montos como string decimal y formato COP; motivo obligatorio en acciones críticas.
- [ ] 4.3 Pruebas Vitest de formularios y visibilidad.

## 5. Verificación

- [ ] 5.1 Pasar `openspec validate crear-control-center-cuentas-contratos --strict`.
- [ ] 5.2 QA en LOCAL: registrar la propuesta actual (plan anual de $850.000 IVA incluido con 1 terminal, extras y certificación de $119.000), validar el desglose de IVA, la prueba de 1 mes, el corte por día de inicio (incluido el caso del día 31) y simular la renovación mensual y anual con bono.
- [ ] 5.3 Documentar la evidencia en `docs/evidencia-control-center-cuentas-contratos.md`.
