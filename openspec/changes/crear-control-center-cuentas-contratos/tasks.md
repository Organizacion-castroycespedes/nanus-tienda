## 1. Prerrequisitos

- [ ] 1.1 Confirmar que `habilitar-plataforma-control-center` está implementado en el target.
- [x] 1.2 Resolver con el propietario IVA (incluido, desde `taxes` del tenant plataforma), certificación ($119.000/año), prueba (1 mes) y corte (día de inicio).
- [x] 1.2b Certificación incluida en el año inicial (ítem `CERTIFICATION` con descuento del 100%).
- [ ] 1.2c Verificar que el tenant plataforma tenga configurado en `public.taxes` el IVA 19% con `is_included=true` en QA y PRD.
- [ ] 1.3 Verificar que `btree_gist` está disponible en QA y PRD; si no, usar la validación por servicio.
- [ ] 1.4 Registrar el ownership en `openspec-scope.json` y asignar el siguiente `V###` libre.

## 2. Base de datos

- [ ] 2.1 Crear `V###__control_center_accounts_contracts.sql` con las tablas, constraints, índices únicos parciales, triggers de inmutabilidad (`contract_versions`, `contract_items`, `plan_price_versions`, `plan_price_components`), `idempotency_keys` y la secuencia de `contract_number`.
- [ ] 2.2 Crear el rollback correspondiente.
- [ ] 2.3 Dry-run en LOCAL, aplicación en LOCAL y diagnóstico de gobernanza en modo STRICT.
- [ ] 2.4 Agregar pruebas SQL de constraints: un vínculo activo por tenant, un contrato vigente por tenant, inmutabilidad y FK `RESTRICT` a `public.tenants`.

## 3. API

- [ ] 3.1 Directorio de tenants (repository con el pool dedicado, keyset y estado de terminales).
- [ ] 3.2 Cuentas comerciales y vínculos (servicio, DTO y auditoría).
- [ ] 3.3 Catálogo de planes y versiones de precio (sin solapes, motivo obligatorio).
- [ ] 3.4 Contratos: creación con snapshot e idempotencia, activación con locks, enmienda, terminación y cancelación.
- [ ] 3.5 Pruebas `node:test`: transiciones, concurrencia de activación (dos clientes), snapshot frente a cambio de catálogo, montos decimales, 403 para otros perfiles e inventario de guards actualizado.

## 4. Web

- [ ] 4.1 Pantallas de directorio, cuentas, planes y contratos (asistente y detalle con historial).
- [ ] 4.2 Formularios con montos como string decimal y formato COP; motivo obligatorio en acciones críticas.
- [ ] 4.3 Pruebas Vitest de formularios y visibilidad.

## 5. Verificación

- [ ] 5.1 Pasar `openspec validate crear-control-center-cuentas-contratos --strict`.
- [ ] 5.2 QA en LOCAL: registrar la propuesta actual (plan anual de $850.000 IVA incluido con 1 terminal, extras y certificación de $119.000), validar el desglose de IVA, la prueba de 1 mes, el corte por día de inicio (incluido el caso del día 31) y simular la renovación mensual y anual con bono.
- [ ] 5.3 Documentar la evidencia en `docs/evidencia-control-center-cuentas-contratos.md`.
