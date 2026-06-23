## Context

El paquete `desktop/electron` ya compila TypeScript a `dist/`, usa `main: dist/main.js`, carga Manus POS Web en modo online y resuelve configuracion local con variables `MANUS_*`.

Esta fase agrega empaquetado Windows minimo para validar un build desktop local. El objetivo no es producir un instalador de produccion firmado, sino verificar que el shell Electron compilado puede empaquetarse y ejecutarse manteniendo el mismo comportamiento online.

Discovery inicial:

| Item | Resultado |
| --- | --- |
| Rama | `feat/0.0.1/arquitectura-clientes-web-electron` |
| Worktree | Limpio |
| Ultimos commits | `d0b98ab`, `9f84bc0`, `64d9e68` |
| Electron main | `desktop/electron/main.ts` |
| Package actual | `main` apunta a `dist/main.js` |
| Herramienta elegida | `electron-builder` |

## Goals / Non-Goals

**Goals:**

- Agregar configuracion Windows-first para empaquetado local.
- Generar build desempaquetado Windows con target `dir`.
- Dejar target `portable` como opcion inicial si el entorno lo permite.
- Mantener scripts actuales de desarrollo, build, tests y typecheck.
- Mantener variables de entorno soportadas por el shell empaquetado.
- Documentar comandos, salida, limites y evidencia QA.

**Non-Goals:**

- No crear instalador productivo obligatorio.
- No exigir `.msi`.
- No implementar firma de codigo.
- No agregar certificados.
- No implementar auto-update.
- No publicar releases automaticamente.
- No implementar offline ni sincronizacion.
- No integrar perifericos.
- No tocar backend, SQL, permisos ni logica operativa.

## Decisions

### 1. Usar `electron-builder`

Decision: usar `electron-builder` como herramienta de empaquetado inicial.

Rationale: es una opcion madura para Electron, soporta Windows `dir`, `portable`, `nsis`, metadata de aplicacion y salida local sin requerir publicacion.

Alternativa considerada: `electron-forge`. Se descarta para esta fase porque implicaria otra estructura de configuracion y no aporta ventaja clara para un shell minimo ya existente.

### 2. Salida local en `release/`

Decision: configurar `directories.output` como `release`.

Rationale: separa artefactos de empaquetado del `dist/` TypeScript compilado. Evita confundir output de build con artefactos distribuibles.

Alternativa considerada: usar `dist/`. Se descarta porque `dist/` ya representa salida compilada TypeScript.

### 3. Target `dir` primero

Decision: `pack:win` genera un build Windows desempaquetado con `electron-builder --win dir --publish never`.

Rationale: valida empaquetado rapidamente sin crear instalador, firma ni flujo de instalacion. Es el paso mas simple para revisar runtime.

Alternativa considerada: `nsis` primero. Se descarta porque instalador agrega variables de instalacion, permisos, firma y UX que no son objetivo de esta fase.

### 4. Target `portable` opcional

Decision: `dist:win` genera `portable` como opcion inicial.

Rationale: permite validar un ejecutable transportable en Windows cuando el entorno lo soporte, sin llegar todavia a `.msi`.

Alternativa considerada: `.msi`. Se descarta porque no es necesario para la primera validacion y puede requerir decisiones adicionales.

### 5. Sin firma, auto-update ni publicacion

Decision: no configurar certificados, firma de codigo, auto-update ni publish.

Rationale: esta fase solo valida empaquetado local. Firma y actualizacion requieren politicas, secretos, canales de release y soporte operativo.

## Risks / Trade-offs

| Riesgo | Mitigacion |
| --- | --- |
| `electron-builder` puede descargar binarios o caches | Registrar si se requiere acceso externo durante `npm install` o build. |
| Build local puede ser dependiente de Windows | Documentar Windows como primer target y Linux/macOS como futuro. |
| Runtime empaquetado puede no abrir si la web no esta disponible | Registrar estado runtime como PASS solo si se abre realmente; si no, usar pending o blocked. |
| Firma ausente puede disparar advertencias de Windows | Documentar que firma queda fuera de alcance hasta fase posterior. |
| Artefactos grandes pueden entrar a Git | Agregar exclusiones para `desktop/electron/release/`, `dist/` y `out/`. |

## Migration Plan

No hay migracion de datos.

Pasos:

1. Agregar `electron-builder` en `desktop/electron`.
2. Agregar metadata y configuracion `build` en `package.json`.
3. Agregar scripts `pack`, `pack:win` y `dist:win`.
4. Agregar exclusiones de artefactos a `.gitignore`.
5. Actualizar documentacion y evidencia QA.
6. Ejecutar typecheck, tests, build, packaging y OpenSpec strict.

Rollback: revertir cambios en `desktop/electron/package.json`, `package-lock.json`, `.gitignore`, docs y OpenSpec. No hay cambios backend, SQL ni permisos que revertir.

## Open Questions

- Si fase futura usara `portable`, `nsis`, `.msi` o combinacion para clientes finales.
- Si se firmara con certificado OV/EV y que proceso custodiará secretos.
- Si auto-update se hara con canal QA/produccion, CDN, GitHub Releases u otro origen.
- Si Linux/macOS heredaran el mismo paquete o tendran cambios por drivers/perifericos.
