## 1. Discovery

- [x] 1.1 Revisar frontend `/{tenant}/finance/current-shift` y cliente de reporteria.
- [x] 1.2 Revisar `backend-reporteria` para `GET /api/reports/current-shift`, scope por rol y tests existentes.
- [x] 1.3 Revisar endpoints existentes de sesiones de caja y confirmar que no se requiere SQL.

## 2. Backend-reporteria

- [x] 2.1 Agregar tipos `terminalId`, `cashRegisterId` y `availableCashSessions` al contrato de turno actual.
- [x] 2.2 Implementar listado seguro de sesiones abiertas disponibles con filtros por tenant, sucursal, terminal, caja y busqueda.
- [x] 2.3 Ajustar seleccion por defecto y por `cashSessionId` sin fuga cross-tenant ni sesiones cerradas.
- [x] 2.4 Agregar tests de `SUPER_USER` con multiples sesiones, seleccion explicita, `USER` limitado, cross-tenant y sesion cerrada.

## 3. Web

- [x] 3.1 Actualizar tipos y cliente de reporteria para nuevos filtros/respuesta.
- [x] 3.2 Agregar selector/contexto operativo de sesiones abiertas en `finance/current-shift`.
- [x] 3.3 Refrescar reporte al cambiar `cashSessionId` y mantener estados de una, varias y cero sesiones.
- [x] 3.4 Agregar pruebas frontend auxiliares donde aplique o documentar brecha de harness.

## 4. QA y evidencia

- [x] 4.1 Crear `docs/evidencia-qa-filtro-turno-actual-multisucursal.md`.
- [x] 4.2 Registrar reglas por rol, contratos API, validaciones ejecutadas y pendientes QA manual.

## 5. Validacion

- [x] 5.1 Ejecutar `openspec.cmd validate mejorar-filtro-turno-actual-multisucursal --type change --strict`.
- [x] 5.2 Ejecutar `openspec.cmd validate --all --strict`.
- [x] 5.3 Ejecutar tests/build relacionados de `backend-reporteria` y confirmar si `api` no fue tocado.
- [x] 5.4 Ejecutar `web` lint/build y pruebas frontend disponibles.
- [x] 5.5 Ejecutar `git diff --check` y `git status --short`.
