# Evidencia - Binarios unificados - MVP-00.7B

Fecha: 2026-06-10

Cambio OpenSpec: `mvp-web-hardening`

Fase: `MVP-00.7B - Binarios unificados`

Resultado: `QA_BACKEND_BINARIES_STANDARDIZED`

## Objetivo

Normalizar la generacion de binarios `pkg` para los cuatro backends:

- `api`
- `backend-reporteria`
- `backend-facturacion-electronica`
- `backend-perifericos`

Esta fase no ejecuta deploy, no toca AWS, no modifica secretos, no reinicia PM2, no sube binarios, no cambia endpoints, no cambia logica funcional y no toca base de datos.

## Inventario de package.json

| Servicio | Ruta | `build` | `build:bin` | `pkg.targets` | `pkg.outputPath` | Binario Linux esperado | Binario Windows esperado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| API principal | `api/` | `tsc -p tsconfig.json` | `npm run build && pkg . --compress Brotli` | `node18-linux-x64`, `node18-win-x64` | `dist-bin` | `dist-bin/api-linux` | `dist-bin/api-win.exe` |
| Reporteria | `backend-reporteria/` | `tsc -p tsconfig.json` | `npm run build && pkg . --compress Brotli` | `node18-linux-x64`, `node18-win-x64` | `dist-bin` | `dist-bin/backend-reporteria-linux` | `dist-bin/backend-reporteria-win.exe` |
| Facturacion electronica | `backend-facturacion-electronica/` | `tsc -p tsconfig.build.json` | `npm run build && pkg . --compress Brotli` | `node18-linux-x64`, `node18-win-x64` | `dist-bin` | `dist-bin/backend-facturacion-electronica-linux` | `dist-bin/backend-facturacion-electronica-win.exe` |
| Perifericos | `backend-perifericos/` | `tsc -p tsconfig.build.json` | `npm run build && pkg . --compress Brotli` | `node18-linux-x64`, `node18-win-x64` | `dist-bin` | `dist-bin/backend-perifericos-linux` | `dist-bin/backend-perifericos-win.exe` |

## Configuracion pkg por servicio

### `api/`

Estado: cumple estandar de targets, outputPath y `build:bin`.

Config relevante:

- `bin`: `dist/main.js`
- `targets`: `node18-linux-x64`, `node18-win-x64`
- `outputPath`: `dist-bin`
- `scripts`: `dist/**/*.js`
- `compress`: `Brotli`
- `assets`: `dist/**/*`

Ajuste aplicado:

- Se removio `.env*` de `pkg.assets` para evitar empaquetar secretos reales.

### `backend-reporteria/`

Estado: cumple estandar de targets, outputPath y `build:bin`.

Config relevante:

- `bin`: `dist/main.js`
- `targets`: `node18-linux-x64`, `node18-win-x64`
- `outputPath`: `dist-bin`
- `scripts`: `dist/**/*.js`
- `compress`: `Brotli`
- `assets`:
  - `dist/**/*`
  - `node_modules/pdfmake/package.json`
  - `node_modules/pdfmake/examples/fonts/**/*`
  - `node_modules/@foliojs-fork/linebreak/src/**/*.trie`
  - `node_modules/@foliojs-fork/pdfkit/js/data/**/*`

Ajuste aplicado:

- Se removio `.env*` de `pkg.assets` para evitar empaquetar secretos reales.
- Se conservaron assets de `pdfmake`/`pdfkit`, porque reporteria los necesita para generar PDF.

### `backend-facturacion-electronica/`

Estado: normalizado en esta fase.

Config relevante:

- `bin`: `dist/main.js`
- `build`: `tsc -p tsconfig.build.json`
- `build:bin`: `npm run build && pkg . --compress Brotli`
- `targets`: `node18-linux-x64`, `node18-win-x64`
- `outputPath`: `dist-bin`
- `scripts`: `dist/**/*.js`
- `compress`: `Brotli`
- `assets`: `dist/**/*`
- `devDependency`: `pkg@^5.8.1`

No se agrego `.env*` a assets.

### `backend-perifericos/`

Estado: normalizado en esta fase.

Config relevante:

- `bin`: `dist/main.js`
- `build`: `tsc -p tsconfig.build.json`
- `build:bin`: `npm run build && pkg . --compress Brotli`
- `targets`: `node18-linux-x64`, `node18-win-x64`
- `outputPath`: `dist-bin`
- `scripts`: `dist/**/*.js`
- `compress`: `Brotli`
- `assets`: `dist/**/*`
- `devDependency`: `pkg@^5.8.1`

No se agrego `.env*` a assets.

## Riesgo de `.env` y secretos

Riesgo detectado:

- `api/package.json` y `backend-reporteria/package.json` incluian `.env*` en `pkg.assets`.
- Si se ejecutaba `npm run build:bin` con `.env` real presente, `pkg` podia empaquetar secretos dentro del binario.

Ajuste aplicado:

- `.env*` fue removido de `pkg.assets` en `api` y `backend-reporteria`.
- Los nuevos backends usan solo `dist/**/*` como asset.
- No se leyo ni imprimio contenido de `.env`.

Convencion segura:

- `.env.example` puede versionarse.
- `.env` real no debe ir en git.
- Runtime `.env` debe vivir fuera del binario, en AWS o al lado del binario segun el diseno actual de runtime.
- Los logs, docs y evidencias no deben imprimir tokens, passwords, private keys ni cadenas de conexion reales.

## Scripts opcionales creados

Se crearon scripts locales, sin deploy y sin AWS:

- `scripts/build/build-all-backends.sh`
- `scripts/build/verify-backend-binaries.sh`

`build-all-backends.sh`:

- ejecuta `npm run build:bin` en los cuatro backends;
- no hace deploy;
- no sube artefactos;
- no toca AWS;
- no reinicia PM2.

`verify-backend-binaries.sh`:

- valida existencia de los binarios Linux esperados:
  - `api/dist-bin/api-linux`
  - `backend-reporteria/dist-bin/backend-reporteria-linux`
  - `backend-facturacion-electronica/dist-bin/backend-facturacion-electronica-linux`
  - `backend-perifericos/dist-bin/backend-perifericos-linux`
- no valida Windows para no exigir ejecucion cruzada adicional fuera del build ya configurado;
- no hace deploy.

## Cambios realizados

- `api/package.json`: remocion de `.env*` en `pkg.assets`.
- `backend-reporteria/package.json`: remocion de `.env*` en `pkg.assets`.
- `backend-facturacion-electronica/package.json`: agregado `bin`, `build:bin`, `pkg` y `pkg` devDependency.
- `backend-facturacion-electronica/package-lock.json`: actualizado con `pkg`.
- `backend-perifericos/package.json`: agregado `bin`, `build:bin`, `pkg` y `pkg` devDependency.
- `backend-perifericos/package-lock.json`: actualizado con `pkg`.
- `scripts/build/build-all-backends.sh`: creado.
- `scripts/build/verify-backend-binaries.sh`: creado.
- `.gitignore`: agregado ignore para `dist-bin/` generado y exception para versionar `scripts/build/*.sh` aunque exista regla general `build/`.

## Validaciones

Comandos ejecutados localmente:

```bash
cd backend-facturacion-electronica
npm.cmd install --ignore-scripts
npm.cmd run build
npm.cmd run build:bin

cd backend-perifericos
npm.cmd install --ignore-scripts
npm.cmd run build
npm.cmd run build:bin

cd api
npm.cmd run build
npm.cmd run build:bin

cd backend-reporteria
npm.cmd run build
npm.cmd run build:bin

bash -n scripts/build/build-all-backends.sh
bash -n scripts/build/verify-backend-binaries.sh
bash scripts/build/verify-backend-binaries.sh
openspec.cmd validate mvp-web-hardening --type change --strict
git diff --check
git status --short
```

Resultados:

| Comando | Resultado |
| --- | --- |
| `backend-facturacion-electronica npm.cmd install --ignore-scripts` | PASS. Agrego `pkg` local y lockfile. `npm audit` reporto 9 vulnerabilidades transitorias. |
| `backend-perifericos npm.cmd install --ignore-scripts` | PASS. Agrego `pkg` local y lockfile. `npm audit` reporto 9 vulnerabilidades transitorias. |
| `backend-facturacion-electronica npm.cmd run build` | PASS. |
| `backend-facturacion-electronica npm.cmd run build:bin` | PASS. Genero `backend-facturacion-electronica-linux` y `backend-facturacion-electronica-win.exe`. |
| `backend-perifericos npm.cmd run build` | PASS. |
| `backend-perifericos npm.cmd run build:bin` | PASS. Genero `backend-perifericos-linux` y `backend-perifericos-win.exe`. |
| `api npm.cmd run build` | PASS. |
| `api npm.cmd run build:bin` | PASS. Genero `api-linux` y `api-win.exe`. |
| `backend-reporteria npm.cmd run build` | PASS. |
| `backend-reporteria npm.cmd run build:bin` | PASS. Genero `backend-reporteria-linux` y `backend-reporteria-win.exe`. |
| `bash -n scripts/build/build-all-backends.sh` | PASS. |
| `bash -n scripts/build/verify-backend-binaries.sh` | PASS. |
| `bash scripts/build/verify-backend-binaries.sh` | PASS. Los cuatro binarios Linux esperados existen. |
| `openspec.cmd validate mvp-web-hardening --type change --strict` | PASS. `Change 'mvp-web-hardening' is valid`. |
| `git diff --check` | PASS. Git emitio warnings LF -> CRLF en package/task files. |
| `git status --short` | PASS. Cambios esperados listados en repo local. |

Notas:

- `pkg` emitio warnings `Failed to make bytecode node18-x64` para algunos archivos de dependencias y `DEP0040` por `punycode`. El comando termino con exit code `0` y los binarios esperados fueron generados.
- No se subieron binarios ni se copiaron a ningun host remoto.

## Restricciones cumplidas

- No se ejecuto deploy.
- No se toco AWS.
- No se modificaron secretos.
- No se reinicio PM2.
- No se subieron binarios.
- No se cambiaron endpoints.
- No se cambio logica funcional.
- No se toco base de datos.
