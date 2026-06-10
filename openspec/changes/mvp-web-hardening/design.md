# Diseno: mvp-web-hardening

## Objetivo

Preparar Manus POS para una salida MVP WEB estable, comercializable y operable sin depender de hardware fisico.

La prioridad de esta iniciativa es calidad operativa:

- estabilidad funcional,
- QA con datos reales,
- facturacion electronica,
- reportería,
- despliegue,
- soporte,
- monitoreo,
- experiencia multiusuario y multisucursal.

## Principios

- No crear nuevas funcionalidades de hardware.
- No activar adapters reales.
- Mantener perifericos MOCK como soporte de QA y operacion demo.
- No romper ventas, compras, pedidos, inventario ni caja.
- No modificar reglas fiscales sin fase explicitamente aprobada.
- Preferir fixes pequeños y evidencias QA sobre refactors amplios.
- Mantener Spec-Driven Development: OpenSpec, evidencia QA, README y codigo sincronizados.

## Arquitectura objetivo MVP WEB

```text
Web Next.js
  - POS
  - Inventario
  - Compras
  - Pedidos
  - Clientes / Proveedores
  - Caja / Finanzas
  - Reporteria
  - Configuracion
  - Health / Version / Soporte
        |
        v
API NestJS
  - negocio
  - FE
  - reportería operativa web
  - auditoría
  - health/version
        |
        v
PostgreSQL
  - datos multi-tenant
  - migraciones
  - auditoría
```

`backend-perifericos` queda como servicio MOCK/local ya completado por `add-pos-peripherals-platform`. Esta iniciativa solo lo valida para asegurar que no se rompa.

## Arquitectura Local - QA AWS - PRD

Manus POS debe validar el MVP en una instancia QA AWS antes de cualquier despliegue PRD.

```text
Local Development
  - desarrollo iterativo
  - tests unitarios
  - migraciones locales
  - smoke basico
        |
        v
QA AWS Environment
  - instancia remota controlada
  - base QA aislada
  - migraciones aplicadas con historial
  - Web/API expuestos con configuracion QA
  - smoke remoto autenticado
  - evidencias QA
        |
        v
PRD
  - despliegue solo luego de QA aprobado
  - migraciones con ventana/control
  - rollback definido
  - monitoreo y soporte activo
```

Reglas:

- Local SHALL usarse para desarrollo y validacion rapida.
- QA AWS SHALL usarse para validar comportamiento remoto, configuracion, migraciones, smoke tests y evidencias antes de PRD.
- PRD SHALL recibir despliegues solo cuando QA AWS tenga resultado aprobado.
- QA AWS SHALL usar datos controlados o anonimizados. No usar secretos PRD en evidencias.
- QA AWS SHALL validar Web, API, DB, health, version, permisos, FE y reportería.

## Fases propuestas

### MVP-00 - QA AWS Environment Readiness

Preparar y validar el ambiente QA AWS antes de ejecutar QA funcional profunda.

Validar:

- instancia o entorno QA AWS disponible,
- variables de entorno QA documentadas,
- API accesible remotamente,
- Web accesible remotamente,
- DB QA aislada,
- migraciones aplicables,
- rollback definido,
- health checks remotos,
- smoke tests remotos,
- evidencias QA,
- ausencia de dependencias de hardware fisico.

Resultado esperado:

- runbook QA AWS,
- evidencia de readiness,
- decision `QA_AWS_READY` o `QA_AWS_BLOCKED`.

### MVP-01 - QA Operativo Integral

Validar con datos reales:

- ventas,
- compras,
- pedidos,
- inventario,
- clientes,
- proveedores,
- caja,
- reportería,
- permisos,
- multisucursal,
- perifericos MOCK.

Resultado esperado:

- matriz QA,
- bugs encontrados,
- fixes minimos,
- evidencia reproducible.

### MVP-02 - Facturacion Electronica Hardening

Fortalecer:

- clientes FE,
- proveedores FE,
- GetAcquirer,
- validaciones,
- eventos,
- estados,
- errores seguros,
- reportería FE.

Resultado esperado:

- flujos fiscales confiables,
- errores claros,
- datos fiscales trazables,
- evidencia sin llamadas externas no autorizadas.

### MVP-03 - Reporteria Operativa

Completar vistas y/o endpoints MVP para:

- compras,
- pedidos,
- clientes,
- productos,
- inventario,
- caja,
- rentabilidad.

Resultado esperado:

- reportes filtrables por tenant/sucursal/fecha,
- totales coherentes,
- export o impresion si ya existe patron,
- evidencia contra datos reales.

### MVP-04 - Terminales POS Hardening

Fortalecer:

- seleccion de terminal,
- contexto de sucursal,
- caja activa,
- fallback MOCK,
- errores de configuracion,
- multiusuario.

Resultado esperado:

- POS no opera con contexto ambiguo,
- feedback claro,
- no se rompe perifericos MOCK.

### MVP-05 - Versionamiento y Release Management

Exponer:

- version de sistema,
- release,
- build,
- commit si esta disponible,
- estado de migraciones,
- ambiente,
- servicios activos.

Resultado esperado:

- UI y/o endpoint de version,
- checklist release,
- evidencia de build y migraciones.

### MVP-06 - Auditoria Operativa

Fortalecer trazabilidad de eventos operativos:

- venta creada/cancelada,
- compra creada/recibida/cancelada/liquidada,
- pedido creado/editado/entregado,
- caja abierta/cerrada/movimientos,
- cambios criticos de inventario,
- cambios de configuracion.

Resultado esperado:

- eventos minimos auditables,
- actor/tenant/sucursal,
- sin exponer secretos,
- evidencia.

### MVP-07 - Health Monitoring

Fortalecer health checks:

- API,
- DB,
- Web,
- backend-perifericos MOCK,
- migraciones,
- servicios externos FE si aplica.

Resultado esperado:

- endpoints o panel operativo,
- estados claros,
- errores controlados,
- evidencia.

### MVP-08 - QA Final MVP

Ejecutar checklist formal de salida MVP:

- build/test,
- smoke autenticado,
- QA por rol,
- QA por modulo,
- QA multisucursal,
- QA FE,
- QA reportería,
- QA fallback,
- evidencia final.

Resultado esperado:

- recomendacion `MVP_WEB_READY` o `MVP_WEB_BLOCKED`.

## Datos y migraciones

- Las migraciones nuevas solo se crean si una fase lo justifica.
- Toda migracion debe ser idempotente si el proyecto sigue ese patron.
- No aplicar a PRD sin aprobacion operativa.
- Se debe documentar aplicacion local/QA.

## Estrategia de migraciones

La estrategia de migraciones para MVP WEB debe separar claramente Local, QA AWS y PRD.

Reglas:

- Local: aplicar migraciones para desarrollo y tests.
- QA AWS: aplicar migraciones antes de smoke remoto y registrar evidencia.
- PRD: no aplicar migraciones hasta que QA AWS este aprobado.
- Toda migracion nueva SHOULD ser idempotente cuando el patron del proyecto lo permita.
- Toda migracion nueva SHALL documentar impacto, precondiciones y rollback posible.
- El historial de migraciones SHALL poder consultarse o auditarse en QA AWS.

## Estrategia de rollback

Rollback debe cubrir aplicacion y base de datos.

Reglas:

- Para aplicacion: conservar version/build anterior desplegable.
- Para DB: documentar si el rollback es automatico, manual o no reversible.
- Para migraciones no reversibles: exigir backup/snapshot antes de aplicar.
- QA AWS SHALL ejecutar o documentar el rollback antes de autorizar PRD.
- PRD SHALL tener ventana de despliegue, responsables y criterio de abortar.

## Smoke tests remotos

QA AWS debe tener smoke tests remotos minimos:

- `GET /health` API.
- Web login page responde.
- Login autenticado de usuario QA autorizado.
- Menu/permissions cargan.
- POS route responde.
- Inventario/productos responde.
- Compras route responde.
- Pedidos route responde.
- Reportería route responde.
- Version/build visible o consultable.
- Estado de migraciones validado.
- `backend-perifericos` MOCK no requerido para PRD, pero su ausencia no debe romper Web MVP.

Los smoke remotos SHALL generar evidencia con fecha, ambiente, URL sanitizada, usuario/rol usado sin credenciales y resultado.

## Evidencias QA AWS

Cada evidencia QA AWS debe incluir:

- objetivo,
- ambiente,
- URL/base remota sanitizada,
- version/build,
- migraciones aplicadas,
- smoke tests ejecutados,
- resultado,
- bugs/fixes,
- rollback validado o documentado,
- riesgos,
- decision `QA_AWS_READY` o `QA_AWS_BLOCKED`.

## Seguridad

- No introducir secretos en `.env.example`, docs o evidencias.
- No imprimir tokens ni credenciales en evidencias.
- Mantener tenant-aware y RBAC.
- Evitar stack traces en UI.
- Validar errores controlados.

## QA y evidencias

Cada fase debe crear evidencia en `docs/` con:

- objetivo,
- alcance,
- ambiente,
- datos usados,
- comandos ejecutados,
- resultados,
- bugs/fixes,
- riesgos,
- restricciones cumplidas.

Validaciones comunes:

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

## Restricciones

No implementar:

- impresora real,
- scanner real,
- balanza real,
- caja real,
- Electron,
- Capacitor,
- USB,
- serialport,
- HID,
- drivers.

No modificar:

- `backend-perifericos/` salvo bugs,
- `add-pos-peripherals-platform` salvo bugs,
- reglas fiscales nuevas sin fase aprobada.

## Criterio de cierre de la iniciativa

La iniciativa se cierra cuando:

- MVP-01 a MVP-08 estan ejecutadas o justificadamente cerradas,
- builds y tests pasan,
- OpenSpec valida,
- git diff check pasa,
- QA final emite `MVP_WEB_READY`,
- riesgos residuales quedan documentados,
- no existe dependencia de hardware fisico para operar el MVP WEB.
