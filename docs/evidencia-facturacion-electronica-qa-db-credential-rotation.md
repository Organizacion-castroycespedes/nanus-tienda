# Rotación de credencial QA de FactuCore

Fecha: 2026-09-10

## Resultado

- Se corrigió el error anterior de PostgreSQL tipando explícitamente los parámetros usados para construir la sentencia DDL segura.
- Se rotó la credencial del rol QA de FactuCore.
- Base validada: `factucore`, esquema `public`, rol `postgres`.
- Se actualizó únicamente `D:/Profe/Factucore/backend/.env`.
- Se reinició únicamente el proceso local FactuCore.
- `FACTUCORE_BACKGROUND_JOBS_ENABLED=false` quedó conservado.

## Seguridad

- No se registró la credencial anterior.
- No se registró la credencial nueva.
- No se registró el `DATABASE_URL`.
- La credencial anterior no se probó de nuevo para evitar reutilizar el secreto expuesto.
- No se tocó PROD.

## Validaciones

- Nueva conexión QA: PASS.
- `current_database()`: `factucore`.
- `current_schema()`: `public`.
- `current_user`: `postgres`.
- Health local FactuCore: HTTP 200.
- GET autenticado de negocio: no ejecutado; no hay secreto de API en texto plano seguro para reutilizar.
- Worker global: deshabilitado.
- pg-boss: sin jobs y sin worker activo.

## Invariantes

- Documento controlado `33b68113-0737-4492-9bf4-ccbe84ccb58c`: `SIGNED`.
- `TransmissionAttempt`: cero.
- Documento de provider: uno.
- Duplicado: no.
- Manus: `PROCESSING`.
- Outbox: `PENDING`.
- No hubo transmisión, polling, XML, firma, creación ni cambio de estado documental.

## Validación autenticada posterior

- FactuCore health local: HTTP `200`.
- Credenciales del API client QA: presentes, sin imprimir valores.
- GET autenticado de solo lectura al estado del documento: HTTP `200`.
- Resolución del API client: PASS.
- Resolución de tenant: PASS.
- Documento controlado localizado: `33b68113-0737-4492-9bf4-ccbe84ccb58c`.
- Estado observado: `SIGNED`.
- Documentos de provider: `1`.
- Duplicado: no.
- Workers FactuCore/Manus: deshabilitados.
- pg-boss: quiescente.
- Decisión: bloqueo de seguridad despejado para autenticación; transmisión directa lista, pero no ejecutada en esta tarea.

## Causa anterior

La ejecución previa falló antes de PostgreSQL porque `format()` recibió parámetros sin tipo resoluble en el prepared statement. La corrección usa `::text` en los parámetros y `quote_ident`/`quote_literal` del servidor antes de ejecutar el DDL.
