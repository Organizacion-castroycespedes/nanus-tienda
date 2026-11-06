# Evidencia de validacion

## Git y alcance

- `git branch --show-current`: `fix/develop/admin-product-fiscal-advanced` - PASS.
- HEAD/base inicial: `9f81261a76c90ffdca0107a5834ac4735fd920fa`, merge-base con `develop` igual - PASS.
- Worktree inicial: limpio; no habia cambios ajenos - PASS.
- No se modificaron backend, DB, endpoints, contratos, RBAC global, POS, FactuCore ni calculos fiscales - PASS por diff.

## OpenSpec y gobernanza

- `openspec validate habilitar-fiscal-avanzado-productos-admin --strict`: PASS antes de implementar y PASS repetido el 2026-11-05.
- Diagnostico `openspec_governance_diagnostic.py --change habilitar-fiscal-avanzado-productos-admin --target-ref origin/develop --enforcement-mode STRICT`:
  - cobertura del diff: `COVERAGE_VISIBLE`;
  - archivos gobernados: `CURRENT_SINGLE_MATCH`;
  - ownership ambiguo: ninguno;
  - strict individual del cambio: exit `0`, PASS;
  - resultado global: `STRICT_REJECTED`, exit `2`.
- El reporte global contiene 12 `OPENSPEC_GLOBAL_VALIDATION_FAILED` ajenos al scope. El diagnostico actual los clasifica en `global_new_failures`, no en `global_preexisting_failures`.
- Aunque estos fallos ya estaban reportados en el contexto previo, la herramienta actual no justifica tratarlos como baseline historico. Requieren clasificacion o correccion por el owner de gobernanza antes de autorizar merge.
- El bloqueo global no demuestra un defecto del OpenSpec nuevo, pero si impide declarar la gobernanza global en PASS.
- `openspec validate --all --strict`: 120 PASS, 12 FAIL. Fallan once specs con `Purpose` placeholder (`access-role-audit`, `catalog-action-focus-ux`, ocho `deliveries-*` y `promotion-action-focus-ux`) y el cambio ajeno `soportar-productos-no-inventariables` por escenarios omitidos en bloques `MODIFIED`.

## Frontend

- Dependencias verificadas en `web/package-lock.json` lockfile v3: `recharts` 2.15.4, `vitest` 1.6.1 y `@testing-library/react` 14.3.1.
- `npm ci`: BLOCKED por `EPERM` al intentar eliminar `next-swc.win32-x64-msvc.node`, retenido por un proceso Node activo.
- `npm install`: PASS usando el manifiesto y lock existentes; restauro dependencias sin modificar `package.json` ni `package-lock.json`. Reporto 20 vulnerabilidades del arbol existente y scripts no aprobados para `esbuild`/`unrs-resolver`; no se ejecuto `npm audit fix` ni se cambiaron versiones.
- Vitest focalizado: PASS, 2 archivos y 9 pruebas. Cubre matriz `ADMIN`/`SUPER_USER`/`SUPER_ADMIN`/`USER`, render, payload de creacion, validacion ADV y preservacion en edicion.
- `npm.cmd run lint`: PASS, sin warnings ni errores.
- `tsc --noEmit --pretty false` completo: FAIL por errores en specs ajenos al cambio. No reporto errores en `ProductForm.tsx` ni `ProductForm.spec.tsx`.
- `npm.cmd run build`: PASS. Next.js 14.2.35 compilo, valido tipos y genero las paginas, incluida `/[tenant]/inventory/products`.

## Backend

- Comando intentado: `.\\node_modules\\.bin\\tsx.cmd --test src/common/guards/permissions.guard.spec.ts src/modules/inventory/controllers/product.controller.spec.ts src/modules/inventory/services/product.service.spec.ts`.
- Resultado: BLOCKED antes de ejecutar tests por `SystemError [ERR_SYSTEM_ERROR]`, `uv_os_get_passwd returned ENOMEM (not enough memory)`, Node `v24.21.0`.
- Backend no fue modificado.

## Integracion y despliegue

- Rama local: `fix/develop/admin-product-fiscal-advanced`; HEAD y `origin/develop`: `9f81261a76c90ffdca0107a5834ac4735fd920fa`; divergencia inicial `0/0`.
- `git ls-remote --heads origin fix/develop/admin-product-fiscal-advanced`: sin salida; la rama remota no existe al momento de la verificacion.
- No se hizo commit, push, PR, merge ni despliegue.
- `.github/workflows/deploy-qa-backends.yml` despliega solo backends desde `release/evolutivo/0.0.1`; no despliega `web`.
- `web/vercel.json` confirma configuracion Vercel, pero el repositorio no contiene un workflow versionado que demuestre el mecanismo o branch de despliegue Web QA.
- No existe `web/.vercel/project.json`; no se pudo confirmar proyecto, team, Git integration ni alias QA. `gh` tampoco esta instalado, por lo que no se pueden inspeccionar PR checks/aprobaciones desde este entorno sin otra via autorizada.
- `.github/workflows/deploy-prod-master.yml` construye y despliega web y backends solo por push a `master`; queda fuera del alcance y no debe ejecutarse para QA.

## QA manual

- Casos documentados en `qa.md`.
- El operador/usuario reporto `PASS` local para `ADMIN` en creacion, edicion, modificacion, eliminacion y persistencia despues de recargar.
- Esta evidencia es manual y reportada; no fue observada directamente por el agente y no reemplaza la suite automatizada bloqueada.
- Resultado manual global: `PARTIAL`, porque no se aporto evidencia de la matriz `SUPER_USER`/`SUPER_ADMIN`/`USER`, aislamiento cruzado de tenant, POS, preview fiscal, capturas, payload sanitizado ni ejecucion en QA desplegado.
- No se emitieron documentos fiscales productivos y no se desplego QA ni PRD.
