## Context

Manus POS v0.0.1 esta documentado como base operativa. El home publico ya fue redisenado y desplegado en QA. La siguiente decision necesaria es definir como se usara y desplegara el producto segun tipo de cliente antes de abrir trabajo Electron.

Discovery ejecutado:

| Item | Resultado |
| --- | --- |
| Rama | `feat/0.0.1/arquitectura-clientes-web-electron` |
| HEAD inicial | `689c054` |
| `git status --short` | Limpio al inicio, sin salida |
| `openspec validate --all --strict` | `openspec.ps1` bloqueado por ExecutionPolicy; `C:\nvm4w\nodejs\openspec.cmd validate --all --strict` PASS, 31 passed, 0 failed |

Se reviso sin modificar:

- `web/package.json`, `api/package.json` y ausencia de `package.json` raiz.
- Estructura `web/app`, `web/domains`, `web/modules`, `web/store`.
- Rutas publicas `/`, `/login`, `/forgot-password`, `/unauthorized`.
- Rutas internas tenant: POS, caja/finance, pedidos, clientes, proveedores, compras, inventario, reporteria, terminales, roles, usuarios y configuracion.
- Modulos API: `auth`, `users`, `roles`, `menu`, `permissions`, `inventory`, `finance`, `terminals`, `pos-terminals`, `pos-user-sessions`, `pricing`, `branches`, `tenants`, `locations`.
- Sesion/auth: JWT, refresh, `auth_sessions` segun docs, cache de menu y session manager.
- Permisos/RBAC: `RequirePermission`, `PermissionsGuard`, `AccessControlService`, `MENU_KEYS`.
- POS/caja: contexto POS, carrito, terminales y sesiones POS.
- Busqueda de Electron, Capacitor, PWA, service worker, offline, sync queue, IndexedDB, `localStorage` y `sessionStorage`.

Hallazgo central: Electron no esta implementado ni instalado. No hay PWA/service worker/offline POS. Si existe `localStorage` para contexto/carrito POS y `sessionStorage` para auth/menu cache, pero eso no es soporte offline.

## Goals / Non-Goals

**Goals:**

- Definir clasificacion unica de clientes: Tipo A Web 100%, Tipo B Electron 100%, Tipo D Web + Electron.
- Definir modelo conceptual de despliegue para cada tipo.
- Definir soporte conceptual Electron por sistema operativo: Windows, Linux y macOS.
- Priorizar Windows para la primera fase Electron online.
- Documentar offline solo como consideracion futura.
- Dejar trazabilidad en docs de arquitectura y OpenSpec.

**Non-Goals:**

- No implementar codigo.
- No instalar Electron.
- No instalar Capacitor.
- No disenar mobile.
- No implementar offline.
- No implementar PWA.
- No crear service worker.
- No crear sync engine.
- No crear almacenamiento local nuevo.
- No tocar backend, frontend, SQL, permisos, rutas, contratos API ni logica de negocio.

## Decisions

### 1. Clasificacion cerrada A/B/D

Decision: usar solo Tipo A, Tipo B y Tipo D.

Rationale: reduce ambiguedad comercial y tecnica. No mezcla mobile, PWA ni offline con la fase Electron.

Alternativa considerada: agregar mas tipos para mobile/PWA/offline. Se descarta porque el alcance los excluye explicitamente.

### 2. Tipo A es Web cloud online

Decision: Tipo A opera desde navegador contra Web/API cloud, sin instalacion y sin offline.

Rationale: es el modelo mas simple para administracion, consulta, compras, inventario y reportes. Es multiplataforma por navegador moderno.

Alternativa considerada: PWA. Se descarta en esta fase.

### 3. Tipo B es Electron desktop online

Decision: Electron se analiza como contenedor desktop online. La API cloud sigue siendo la fuente de verdad.

Rationale: permite preparar POS/caja desktop sin duplicar negocio ni crear backend local. Offline queda como investigacion futura.

Alternativa considerada: Electron con offline desde el inicio. Se descarta por complejidad de stock, caja, fiscalidad, duplicados, permisos y sync.

### 4. Tipo D es modelo objetivo para cliente con punto fisico

Decision: recomendar Web para administracion y Electron para POS/caja.

Rationale: separa backoffice de caja fisica. Web mantiene administracion independiente del sistema operativo. Electron permite futuro control de terminal/perifericos.

Alternativa considerada: Web 100% para todos. Se mantiene viable, pero no es ideal para caja fisica con perifericos.

### 5. Prioridad Electron por sistema operativo

Decision: Windows primero, Linux segundo, macOS tercero.

Rationale: Windows es mas probable en POS fisico y clientes no tecnicos. Linux sirve para terminal dedicada/economica con distros certificadas. macOS es mas util para administracion o estaciones mixtas.

Alternativa considerada: soporte multiplataforma simultaneo. Se descarta por costo de QA, empaquetado y perifericos.

### 6. Offline futuro separado

Decision: documentar offline como linea futura, sin diseno definitivo ni implementacion.

Rationale: offline requiere decisiones de datos, seguridad, idempotencia, reconciliacion, consecutivos, caja y fiscalidad. Mezclarlo ahora elevaria riesgo sin necesidad.

Alternativa considerada: crear storage/sync base ahora. Se descarta porque viola alcance y puede introducir deuda antes de requisitos claros.

## Risks / Trade-offs

| Riesgo | Mitigacion |
| --- | --- |
| Drift de version Web/Electron/API | Definir matriz de compatibilidad antes de empaquetar Electron. |
| Perifericos varian por OS/modelo | Certificar hardware por sistema operativo, iniciando con Windows. |
| Usuarios esperan offline por usar desktop | Documentar que Electron inicial es online y falla controlado sin conectividad. |
| Electron absorbe reglas de negocio | Mantener API como fuente de verdad y Electron como shell. |
| Linux/macOS elevan QA temprano | Priorizarlos como soporte posterior. |
| Instaladores bloqueados por seguridad del OS | Planear firma, notarizacion y canales de actualizacion en fase futura. |

## Migration Plan

No hay migracion runtime en esta fase.

Siguiente flujo conceptual:

1. Aprobar arquitectura Tipo A/B/D.
2. Abrir change posterior para Electron base online Windows.
3. Definir matriz de version Web/Electron/API.
4. Definir configuracion tenant/sucursal/terminal.
5. Validar POS/caja online en Electron.
6. Validar perifericos Windows.
7. Empaquetar Windows.
8. Evaluar Linux y macOS.
9. Abrir investigacion offline futura si negocio lo prioriza.

Rollback documental: revertir este change de docs/OpenSpec. No hay rollback de codigo, SQL ni deploy.

## Open Questions

- Electron cargara web build local o apuntara a Web cloud remoto.
- Como se gestionara configuracion tenant/sucursal/terminal en instalacion.
- Que instalador Windows sera primero: `.exe` o `.msi`.
- Que hardware fisico sera certificado primero.
- Que politica de version minima API aplicara a Electron.
- Si se usara auto-update o instalador manual en pilotos.
