## 1. Seguridad y gobernanza

- [x] 1.1 Confirmar rama `fix/develop/admin-product-fiscal-advanced`, base `develop`, HEAD esperado y worktree sin cambios ajenos antes de implementar; verificar con comandos Git read-only.
- [x] 1.2 Asociar exactamente los archivos tecnicos del cambio en `scripts/governance/openspec-scope.json` sin crear ownership multiple; verificar con el diagnostico de gobernanza.
- [x] 1.3 Validar el cambio OpenSpec en modo estricto antes de editar codigo; verificar que quede apply-ready y strict-valid.

## 2. Implementacion frontend

- [x] 2.1 Extender la capacidad fiscal central existente para incluir `ADMIN` autorizado sin duplicar condiciones; verificar que render, validacion y payload consuman la misma capacidad.
- [x] 2.2 Actualizar comentarios obsoletos sin cambiar contratos, formulas fiscales, backend, DB, POS, FactuCore ni RBAC global; verificar el diff tecnico.

## 3. Pruebas focalizadas

- [x] 3.1 Agregar pruebas de capacidad por rol para `ADMIN`, `SUPER_USER`, `SUPER_ADMIN` y caso negativo `USER`; verificar que el runner frontend las ejecute.
- [x] 3.2 Probar render del acordeon, validacion DANE/ADV y payload de creacion con `taxId`, `taxes`, categoria fiscal y vigencias; verificar assertions de UI y servicio.
- [x] 3.3 Probar edicion con asignaciones existentes, cambio explicito y preservacion sin borrado accidental; verificar el payload enviado al servicio.
- [ ] 3.4 Confirmar aislamiento tenant y ausencia de regresion fiscal mediante contratos/pruebas existentes, sin emitir documentos reales ni escribir DB; verificar frontend y backend focalizados segun disponibilidad.

## 4. Validacion y QA

- [x] 4.1 Ejecutar validacion OpenSpec estricta, diagnostico de gobernanza, `git diff --check` y revision de scope; registrar PASS/FAIL/BLOCKED exacto.
- [x] 4.2 Resolver dependencias solo desde manifiestos/lockfile existentes y ejecutar tests frontend focalizados, lint, typecheck y build; registrar resultados y bloqueos exactos del entorno.
- [x] 4.3 Intentar tests backend relevantes sin modificar backend; registrar `uv_os_get_passwd ENOMEM` u otro bloqueo exacto si reaparece.
- [x] 4.4 Documentar QA manual Premium Brands para `ADMIN`, `SUPER_USER`, `SUPER_ADMIN` y negativo `USER`, incluyendo IVA 19% incluido, edicion, recarga, persistencia, POS y documento fiscal sin emision real.
- [x] 4.5 Registrar QA manual autorizado en ambiente local no productivo: el operador reporto PASS para CRUD y persistencia de `ADMIN`; conservar como PARTIAL los casos no evidenciados de la matriz de roles, tenant, POS y preview fiscal.
