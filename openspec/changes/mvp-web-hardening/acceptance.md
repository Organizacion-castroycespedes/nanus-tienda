# Acceptance: mvp-web-hardening

## Resultado esperado de la iniciativa

Manus POS queda listo para salida `MVP_WEB_READY` cuando pueda operar en Web con estabilidad comercial sin depender de hardware fisico y despues de validar un ambiente QA AWS previo a PRD.

## Criterios generales

1. Existe un ambiente QA AWS definido y validado antes de cualquier despliegue PRD.
2. Arquitectura `Local -> QA AWS -> PRD` documentada.
3. Estrategia de migraciones y rollback documentada para QA AWS y PRD.
4. Smoke tests remotos QA AWS ejecutados o documentados como bloqueantes.
5. Ventas, compras, pedidos, inventario, clientes, proveedores, caja y reportería pasan QA operativo con datos representativos.
6. Facturacion electronica tiene flujos de clientes FE, proveedores FE, GetAcquirer, validaciones y errores controlados.
7. Reporterías operativas MVP estan disponibles, filtrables y coherentes con datos del sistema.
8. POS opera con tenant, sucursal, terminal y caja activa sin contexto ambiguo.
9. Perifericos MOCK siguen funcionando y no bloquean negocio.
10. UI o endpoint de sistema muestra version, release, build o metadata equivalente.
11. Auditoría operativa minima existe o queda documentada con riesgos aceptados.
12. Health monitoring permite diagnosticar API, DB, Web y agent MOCK.
13. Checklist QA final MVP esta ejecutado y documentado.
14. No existe dependencia de hardware fisico para operar el MVP WEB.

## Criterios por fase

### MVP-00 - QA AWS Environment Readiness

- Ambiente QA AWS documentado.
- Arquitectura `Local -> QA AWS -> PRD` documentada.
- Estrategia de migraciones definida.
- Estrategia de rollback definida.
- Smoke tests remotos definidos y ejecutados cuando el ambiente exista.
- Evidencia QA creada.
- Resultado `QA_AWS_READY` o `QA_AWS_BLOCKED` emitido.

### MVP-01 - QA Operativo Integral

- Evidencia QA creada.
- Bugs criticos corregidos o documentados como bloqueantes.
- Flujos principales validados con datos reales o fixtures representativos.

### MVP-02 - Facturacion Electronica Hardening

- Cliente fiscal y proveedor fiscal validados.
- GetAcquirer o provider fiscal controlado validado segun configuracion.
- Errores FE no muestran stack traces ni secretos.

### MVP-03 - Reporteria Operativa

- Reportes MVP validados para compras, pedidos, clientes, productos, inventario, caja y rentabilidad.
- Filtros por fecha, tenant, sucursal y estado documentados segun disponibilidad.

### MVP-04 - Terminales POS Hardening

- POS resuelve contexto operativo o muestra error claro.
- Caja activa y terminal se validan sin romper perifericos MOCK.

### MVP-05 - Versionamiento y Release Management

- Version/release/build visible o consultable.
- Migraciones y checklist release documentados.

### MVP-06 - Auditoria Operativa

- Eventos criticos MVP auditados o riesgo explicitamente documentado.
- No hay secretos ni payloads sensibles en auditoría.

### MVP-07 - Health Monitoring

- Health checks MVP disponibles.
- Fallas de dependencias se reportan como degradacion o error controlado.

### MVP-08 - QA Final MVP

- `api` build/test pasa.
- `web` build pasa.
- `backend-perifericos` build/test pasa.
- OpenSpec validate pasa.
- `git diff --check` pasa.
- Evidencia final recomienda `MVP_WEB_READY` o `MVP_WEB_BLOCKED`.

## Validaciones obligatorias

```bash
cd api
npm.cmd run build
npx.cmd tsx --test "src/**/*.spec.ts"

cd web
npm.cmd run build

cd backend-perifericos
npm.cmd run build
npm.cmd test

openspec.cmd validate mvp-web-hardening --type change --strict
git diff --check
git status --short
```

## Condiciones para `MVP_WEB_READY`

- Builds pasan.
- Tests pasan.
- OpenSpec valida.
- QA AWS tiene resultado `QA_AWS_READY`.
- QA final pasa.
- No hay bugs criticos abiertos.
- No hay secretos en evidencias.
- Migraciones requeridas estan documentadas.
- Perifericos MOCK siguen funcionando.
- No se activo hardware real.

## Condiciones para `MVP_WEB_BLOCKED`

- Cualquier build o test obligatorio falla.
- OpenSpec validate falla.
- QA AWS no existe, no tiene smoke remoto, no tiene rollback definido o emite `QA_AWS_BLOCKED`.
- Existe bug critico en ventas, compras, pedidos, inventario, caja, FE o login.
- Existen datos fiscales inconsistentes sin mitigacion.
- No se puede operar POS Web con contexto claro.
- No se puede validar reportería minima.
- Se detecta secreto en docs, env examples o logs.
- Se requiere hardware fisico para completar MVP WEB.

## Restricciones de aceptacion

- No se acepta impresora real.
- No se acepta scanner real.
- No se acepta balanza real.
- No se acepta caja real.
- No se acepta Electron.
- No se acepta Capacitor.
- No se acepta USB, serialport, HID ni drivers.
- No se acepta activar `PERIPHERALS_ENABLE_REAL_ADAPTERS=true`.
