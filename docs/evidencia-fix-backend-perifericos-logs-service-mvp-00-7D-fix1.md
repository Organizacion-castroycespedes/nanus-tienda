# Evidencia - Fix backend-perifericos LogsService - MVP-00.7D-FIX1

Fecha: 2026-06-10

Resultado esperado: `QA_BACKEND_PERIFERICOS_LOGS_SERVICE_FIXED`

## Problema

GitHub Actions Deploy QA fallo durante build de `backend-perifericos` con:

```text
Cannot find module '../logs/logs.service' or its corresponding type declarations.
```

Archivos que importan `LogsService`:

- `backend-perifericos/src/modules/scanner/scanner.service.ts`
- `backend-perifericos/src/modules/devices/devices.service.ts`
- `backend-perifericos/src/modules/scale/scale.service.ts`
- `backend-perifericos/src/modules/printer/printer.service.ts`
- `backend-perifericos/src/modules/cash-drawer/cash-drawer.service.ts`
- `backend-perifericos/test/network-escpos.spec.ts`
- `backend-perifericos/test/mock-simulator.spec.ts`

## Hallazgo

`LogsService` si existia localmente en:

- `backend-perifericos/src/modules/logs/logs.service.ts`
- `backend-perifericos/src/modules/logs/logs.module.ts`
- `backend-perifericos/src/modules/logs/logs.controller.ts`

Pero `.gitignore` tenia regla global:

```text
logs/
```

Esa regla ignoraba tambien el modulo fuente `backend-perifericos/src/modules/logs/`. En Windows local el build podia pasar porque los archivos estaban en disco, pero en GitHub Actions Linux no existian al hacer checkout limpio.

## Cambio aplicado

Se agrego excepcion precisa en `.gitignore`:

```text
!backend-perifericos/src/modules/logs/
!backend-perifericos/src/modules/logs/**
```

Esto permite versionar solo el modulo fuente `logs` de `backend-perifericos`, sin dejar de ignorar carpetas runtime `logs/` ni archivos `*.log`.

## Compatibilidad de `LogsService`

Metodos requeridos por servicios y tests:

| Metodo | Estado |
| --- | --- |
| `append(input)` | Existe |
| `list()` | Existe |
| `getLimit()` | Existe |
| `clear()` | Existe, helper compatible |

No se agrego persistencia compleja. La implementacion sigue siendo in-memory, compatible con MOCK y tests.

## Validaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| `npm.cmd run build` en `backend-perifericos` | OK |
| `npm.cmd run build:bin` en `backend-perifericos` | OK. `pkg` emitio warnings de bytecode para dependencias, sin fallo |
| `bash scripts/build/verify-backend-binaries.sh` | OK. Los 4 binarios Linux esperados existen |
| `openspec.cmd validate mvp-web-hardening --type change --strict` | OK. `Change 'mvp-web-hardening' is valid` |
| `git diff --check` | OK. Solo warnings LF -> CRLF en archivos modificados |
| `git status --short` | OK. Muestra `.gitignore`, `tasks.md`, modulo `backend-perifericos/src/modules/logs/` y esta evidencia |

## Restricciones confirmadas

- AWS: no tocado.
- Deploy: no ejecutado.
- Secrets: no modificados.
- PM2: no reiniciado.
- Logica funcional: sin cambios.
