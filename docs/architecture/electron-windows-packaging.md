# Electron Windows packaging

Fecha: 2026-06-20  
OpenSpec change: `preparar-empaquetado-electron-windows`

## Objetivo

Preparar empaquetado Windows inicial para Manus POS Electron online, con foco en validacion local del shell desktop. Esta fase permite generar un build Windows sin convertirlo aun en instalador productivo firmado.

## Alcance

- Usar `electron-builder` en `desktop/electron`.
- Mantener Electron como shell online de la web existente.
- Generar build Windows desempaquetado con target `dir`.
- Dejar target `portable` como opcion inicial.
- Mantener `MANUS_WEB_URL`, `MANUS_START_PATH`, `MANUS_TENANT_ID`, `MANUS_BRANCH_ID` y `MANUS_TERMINAL_ID`.
- Documentar comandos, salida y QA tecnico.

## Fuera de alcance

- Backend.
- SQL/migraciones.
- Permisos.
- Logica de negocio.
- POS/caja/pedidos/facturacion.
- Offline.
- Sincronizacion.
- Perifericos.
- Firma de codigo.
- Certificados.
- Auto-update.
- Publicacion automatica de releases.
- Instalador MSI.
- Instalador productivo para cliente final.

## Herramienta elegida

Se usa `electron-builder`.

Motivos:

- Soporta Windows `dir`, `portable`, `nsis` y otros targets.
- Permite validar empaquetado local sin firma.
- Permite desactivar publicacion con `--publish never`.
- Se integra directo en `desktop/electron/package.json`.

## Scripts disponibles

Desde `desktop/electron`:

```powershell
npm run typecheck
npm test
npm run build
npm run pack:win
npm run dist:win
```

| Script | Uso |
| --- | --- |
| `npm run pack` | Alias de empaquetado Windows `dir`. |
| `npm run pack:win` | Compila TypeScript y genera build Windows desempaquetado. |
| `npm run dist:win` | Compila TypeScript y genera ejecutable `portable` si el entorno lo permite. |

## Targets Windows iniciales

| Target | Estado | Uso |
| --- | --- | --- |
| `dir` | Inicial recomendado | Validacion rapida de build desempaquetado. |
| `portable` | Opcion inicial | Validacion de ejecutable transportable sin MSI. |
| `nsis` | Futuro | Instalador clasico si se aprueba en otra fase. |
| `msi` | Futuro | No se implementa en esta fase. |

## Estructura de salida

La salida de empaquetado queda en:

```text
desktop/electron/release/
```

Ejemplos esperados:

```text
desktop/electron/release/win-unpacked/
desktop/electron/release/Manus-POS-0.1.0-x64-portable.exe
```

`desktop/electron/release/`, `desktop/electron/dist/` y `desktop/electron/out/` quedan ignorados por Git.

## Variables soportadas en app empaquetada

La app empaquetada conserva las mismas variables del shell Electron:

| Variable | Uso |
| --- | --- |
| `MANUS_WEB_URL` | URL base de Manus POS Web. |
| `MANUS_START_PATH` | Ruta inicial; debe empezar con `/`. |
| `MANUS_TENANT_ID` | Tenant inicial si no hay `MANUS_START_PATH`. |
| `MANUS_BRANCH_ID` | Contexto local reservado; no cambia URL. |
| `MANUS_TERMINAL_ID` | Contexto local reservado; no cambia URL. |
| `MANUS_ELECTRON_WINDOW_TITLE` | Titulo de ventana. |
| `MANUS_ELECTRON_WINDOW_WIDTH` | Ancho inicial. |
| `MANUS_ELECTRON_WINDOW_HEIGHT` | Alto inicial. |
| `MANUS_ELECTRON_CLOSE_BEHAVIOR` | `quit` o `hide`. |

## Como ejecutar build local

```powershell
cd desktop/electron
npm install
npm run typecheck
npm test
npm run pack:win
```

Para portable:

```powershell
npm run dist:win
```

## Como probar runtime

1. Levantar Manus POS Web o apuntar a una URL disponible.
2. Ejecutar build Windows desempaquetado:

```powershell
$env:MANUS_WEB_URL="http://localhost:3000"
$env:MANUS_START_PATH="/login"
.\release\win-unpacked\Manus POS.exe
```

3. Confirmar:

- Se abre ventana Electron.
- Carga Manus POS Web.
- No hay pantalla blanca.
- No hay crash.
- La app sigue online-only.

## Limitaciones conocidas

- Sin firma de codigo, Windows puede mostrar advertencias de confianza.
- No hay auto-update.
- No hay publicacion automatica de releases.
- No hay instalador MSI.
- `portable` puede requerir descargas/caches de `electron-builder`.
- Runtime depende de que la web/API online esten disponibles.
- No se validan perifericos fisicos.

Nota posterior: la estrategia futura de perifericos POS Windows se documenta en `electron-pos-peripherals-windows.md`. Esa fase es solo analisis y no cambia el empaquetado.

Nota posterior: la impresion inicial de recibos/tickets para Electron Windows se documenta en `electron-receipt-printing-windows.md`; no cambia el empaquetado ni agrega impresion nativa.

## Riesgos

| Riesgo | Mitigacion |
| --- | --- |
| Advertencias por binario sin firma | Firma queda para fase futura con certificados y politica de release. |
| Artefactos pesados en Git | Salida `release/`, `dist/` y `out/` queda ignorada. |
| Build pasa pero runtime falla por web no disponible | QA runtime debe registrar URL usada y resultado real. |
| Portable confundido con instalador final | Documentar que es validacion inicial, no distribucion final. |

## Proximas fases

1. Validar build `dir` en Windows con QA repetible.
2. Validar `portable` y decidir si entra al flujo.
3. Definir instalador productivo (`nsis` o `.msi`).
4. Definir firma de codigo.
5. Definir auto-update y canal de releases.
6. Validar perifericos Windows.
7. Evaluar Linux.
8. Evaluar macOS.

## Por que no firma ni auto-update todavia

Firma y auto-update requieren certificados, custodia de secretos, canal de publicacion, versionado y proceso operativo. Esta fase solo valida empaquetado local Windows.

## Por que no offline ni perifericos todavia

Offline y perifericos cambian comportamiento operativo y superficie de soporte. Esta fase mantiene Electron como contenedor desktop online de la web existente.
