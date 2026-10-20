# Corrección de feedback y fase fiscal — verificación local

Fecha: 2026-10-20. Rama: `fix/pos-sale-feedback-and-billing-phase`.
Base y HEAD sin commits: `47b3895fdd1f6f583bdadf143774360746389c40`.
Worktree inicial limpio. No hubo cambios ajenos superpuestos.

## Decisión y alcance

El rechazo valida cuenta, intento y contexto antes de aplicar el reducer que
elimina `saleAttempt`. La autorización de aviso se captura antes del reducer;
cuenta/contexto se comprueban otra vez al mostrar el diagnóstico en el error de
cobro y toast. Los callbacks obsoletos retornan antes de cambiar metadatos.

El POST muestra `Registrando venta…` en el botón ocupado. El modal fiscal usa
solo `isBillingProcessing` del hook existente, posterior a confirmación comercial.
No cambian clasificador, contratos, store, backend, BD, configuración ni la
semántica UNKNOWN. La revisión `react-best-practices` verificó que no se agregan
hooks/efectos, se conserva el bloqueo/aria-busy y las notificaciones existentes.

El manifest añade `PaymentDialog.tsx` y `useSalePrintWorkflow.spec.ts` al
change y a su ownership actual. No reasigna ownership de otro change.

## Reproducción antes de corregir

La integración monta `PosScreen`, Redux, `usePosCartStore`, `PaymentDialog`,
Toast y `useSalePrintWorkflow` reales. Simula servicios comerciales, fiscales,
catálogos, parámetros y periféricos. `fetch` se sustituye para impedir red real.

La ejecución focalizada de stock y POST pendiente produjo cinco fallos:
stock y FEFO no renderizaban `role=alert`; automático mostraba modal fiscal
durante el POST; faltaba la etiqueta comercial nueva en los otros dos modos.
Estos son fallos RED esperados, previos a la corrección.

Un primer intento también reveló que `vi.restoreAllMocks` borraba defaults de
fixtures entre casos. Se corrigió el teardown para restaurar únicamente el spy
de consola. Una invocación con `--root`/config relativo incorrecto no cargó la
suite; se corrigió usando el directorio `web`. Ninguna es un test PASS.

## Comandos y resultados finales

Desde `web` (rutas de ejecutables absolutas usadas cuando PATH no los resolvió):

```text
C:/nvm4w/nodejs/node.exe node_modules/vitest/vitest.mjs run modules/pos/components/PosScreen.integration.test.tsx --pool=forks --poolOptions.forks.singleFork --reporter=dot
```

PASS: 32 pruebas de integración. Cubren stock/FEFO visible, carrito e intento,
POST pendiente en tres modos FE, validación local sin POST, timeout/red/5xx,
400/403/404/409 ambiguos, contrato incompleto/código no reconocido/status
incorrecto, reconciliación 200/404/409/500, retry explícito con mismo payload y
clave, callbacks tardíos de cuenta/contexto/intento, doble click/Enter y fallos
fiscales posteriores sin restaurar carrito ni repetir POST.

```text
C:/nvm4w/nodejs/node.exe ../api/node_modules/tsx/dist/cli.mjs --test store/posCart.spec.ts modules/pos/utils/sale-recovery.spec.ts modules/pos/utils/sale-postprocessing.spec.ts modules/pos/utils/pos-payment-rules.spec.ts modules/pos/hooks/useSalePrintWorkflow.spec.ts
```

PASS: 32 pruebas de estado, recuperación, pagos y workflow fiscal.

```text
C:/nvm4w/nodejs/node.exe ../api/node_modules/tsx/dist/cli.mjs --test modules/pos/components/PosScreen.scale-fail-closed.spec.ts modules/pos/components/pos-discount-display.spec.ts modules/pos/utils/product-classification.spec.ts
```

PASS: 23 regresiones de peso, descuentos y clasificación POS.

Desde `api`:

```text
C:/nvm4w/nodejs/node.exe node_modules/tsx/dist/cli.mjs --test src/modules/inventory/services/sale-stock-rejection.spec.ts src/modules/inventory/sale-idempotency.spec.ts src/modules/inventory/repositories/sale.repository.spec.ts src/modules/inventory/services/sale.service.spec.ts
```

PASS: 52 pruebas aisladas existentes. Los logs de rechazos son escenarios
esperados con repositorios/DB simulados. No se ejecutaron ventas ni SQL reales.
Estas pruebas no certifican ausencia de persistencia en una BD real.

Desde `web`: `C:/nvm4w/nodejs/npm.cmd run lint` PASS, sin warnings ni errores.
`C:/nvm4w/nodejs/npm.cmd run build` PASS, compilación, chequeo de tipos,
generación de páginas y trazas completos, exit 0. Total tests: 139 PASS.

OpenSpec del change: validación `--strict` PASS. La primera invocación por
PATH falló; la ruta absoluta resolvió la herramienta. Governance antes de
implementar: `STRICT_PASS`, manifest válido y sin acceso a BD. El resultado
de governance sobre todos los archivos ejecutables y manifest modificados fue
`STRICT_PASS`, exit 0, sin hallazgos bloqueantes. Cada archivo tiene
`CURRENT_SINGLE_MATCH`; el manifest conserva su dueño de governance existente.

Desde la raíz:

```text
C:/nvm4w/nodejs/openspec.cmd validate corregir-stock-insuficiente-y-recuperacion-carrito-pos --strict
python -B scripts/governance/openspec_governance_diagnostic.py --change corregir-stock-insuficiente-y-recuperacion-carrito-pos --target-ref develop --openspec-command C:/nvm4w/nodejs/openspec.cmd --enforcement-mode STRICT
git diff --check
```

PASS: change estricto, gate repository-only y diff sin errores de whitespace.
`database_access=false`. Avisos no bloqueantes: fuentes Local/PRD no verificadas
para promoción; no se solicitó promoción ni evidencia remota.

La validación global `openspec.cmd validate --all --strict` se ejecutó y dio
FAIL, exit 1: 128/129 válidos. El único fallo es ajeno y preexistente:
`corregir-handoff-agent-local-perifericos-electron`, requisito
`Electron uses the typed local Agent bridge` sin SHALL o MUST. Se verificó
también por separado. `git diff` contra BASE_HEAD en ese change está vacío.
No se modificó ese OpenSpec. El diagnóstico reporta global_exit=1 pero no
clasifica ese nombre en sus listas de fallos; no se declara PASS global.

Recomendación: `PRE_COMMIT_GO` para esta corrección acotada. No equivale a
certificación global del repositorio, autorización de publicación o QA real.

## Límites y QA pendiente

- NOT_RUN: ventas reales, migraciones, DDL, despliegues, DIAN y escrituras remotas.
- NOT_RUN: QA visual en navegador/Electron, desktop/tablet y hardware real.
- Pendiente: revisar legibilidad del diagnóstico y toast, edición/cancelación
  posterior, tres modos FE y operación con dos terminales en QA autorizado.
- Las tareas históricas 3.1-3.3 y 4.1 siguen pendientes en su alcance completo.
  Esta corrección no certifica el change completo ni la QA histórica.
- Sin commit, push, PR, merge, reset, rebase ni clean. Backend y BD intactos.
