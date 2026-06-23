## Context

El change `definir-clientes-web-electron` dejo definida la arquitectura de clientes:

- Tipo A: Web 100%.
- Tipo B: Electron 100%, online.
- Tipo D: Web + Electron.

La implementacion inicial debe crear una capa desktop minima para Windows primero. El frontend principal sigue siendo `web/` con Next.js. Electron no debe reimplementar rutas, pantallas ni logica de negocio.

Discovery inicial:

| Item | Resultado |
| --- | --- |
| Rama | `feat/0.0.1/arquitectura-clientes-web-electron` |
| HEAD inicial | `689c054` |
| `git status --short` | Solo archivos nuevos del change documental anterior `definir-clientes-web-electron` |
| Root `package.json` | No existe |
| `web/package.json` | Next.js/React sin Electron |
| Electron existente | No se encontro codigo Electron real ni carpeta `desktop/` |

## Goals / Non-Goals

**Goals:**

- Crear `desktop/electron/` como paquete separado.
- Abrir una ventana Electron que cargue `MANUS_WEB_URL` o `http://localhost:3000` por defecto.
- Mantener la app online contra Web/API existentes.
- Configurar seguridad base: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, preload separado y navegacion externa controlada.
- Agregar scripts `dev`, `build` y `typecheck`.
- Documentar ejecucion local y QA tecnico.

**Non-Goals:**

- No implementar offline.
- No implementar sincronizacion.
- No implementar IndexedDB.
- No implementar service worker.
- No instalar Capacitor.
- No modificar backend, SQL, permisos, facturacion, caja, POS, pedidos, clientes ni logica de negocio.
- No integrar perifericos.
- No crear instaladores.
- No configurar firma ni auto-update.
- No implementar impresion nativa.

## Decisions

### 1. Paquete separado en `desktop/electron/`

Decision: crear un paquete independiente.

Rationale: evita tocar `web/package.json` y mantiene Next.js como frontend principal. Electron queda como shell desktop.

Alternativa considerada: agregar Electron dentro de `web/`. Se descarta porque mezcla empaquetado desktop con la app Next.js y aumenta riesgo sobre el frontend.

### 2. Electron carga URL web, no bundle propio

Decision: `BrowserWindow` carga una URL configurable. Default desarrollo: `http://localhost:3000`.

Rationale: cumple online-first y permite usar la web existente sin duplicar rutas ni componentes.

Alternativa considerada: empaquetar un build estatico local. Se descarta para esta fase porque requeriria decisiones de export/build y QA adicional.

### 3. Seguridad base restrictiva

Decision: usar `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, preload separado sin APIs de negocio y bloqueo de navegacion fuera del origen permitido.

Rationale: reduce superficie de ataque sin complicar la fase. Electron queda como contenedor, no como backend local.

Alternativa considerada: permitir Node en renderer para integraciones futuras. Se descarta porque perifericos y APIs nativas estan fuera de alcance.

### 4. Windows-first sin instaladores

Decision: documentar Windows como objetivo primario de desarrollo, pero no generar `.exe` ni `.msi`.

Rationale: Windows es prioridad para POS fisico, pero empaquetado/firma/auto-update requieren fase propia.

Alternativa considerada: empaquetar desde el inicio. Se descarta por alcance y riesgo.

## Risks / Trade-offs

| Riesgo | Mitigacion |
| --- | --- |
| La web local no esta levantada | Default documentado y error esperado si `http://localhost:3000` no responde. |
| Navegacion externa accidental | Bloquear navegacion fuera del origen base y abrir links externos con `shell.openExternal`. |
| Expectativa de offline por usar desktop | Documentar online-only y no crear almacenamiento operativo local. |
| Electron version drift | Mantener paquete aislado y validar con `npm run typecheck`. |
| Windows SmartScreen/firma | Dejar instaladores/firma fuera de alcance y documentarlo como fase futura. |

## Migration Plan

No hay migracion de datos ni despliegue productivo.

Pasos:

1. Crear paquete Electron.
2. Instalar dependencias locales del paquete.
3. Ejecutar `npm run typecheck`.
4. Validar OpenSpec strict.
5. Documentar QA local o pendiente.

Rollback: eliminar `desktop/electron/`, docs del change y OpenSpec change. No hay SQL ni backend que revertir.

## Open Questions

- Si fase futura usara web remota QA/produccion o web build local embebido.
- Si la primera configuracion de tenant/sucursal/terminal sera local, remota o tomada desde login/contexto.
- Si el primer instalador Windows sera `.exe` o `.msi`.
- Que perifericos se certificaran primero.
