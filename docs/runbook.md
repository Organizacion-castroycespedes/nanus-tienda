# Runbook PRD

## Objetivo

Definir la operación mínima segura para despliegue y cambios de base de datos en producción.

## Estructura SQL vigente

Ubicación oficial: `scripts/database`

## Estructura objetivo post-PRD

```text
/scripts/database/
  ├── base/
  ├── migrations/
  ├── seeds/
```

Reglas de oro:

- nunca modificar archivos base ya desplegados en PRD
- toda nueva modificación debe vivir en `scripts/database/migrations`
- formato obligatorio: `YYYYMMDD_description.sql`
- usar `migrations_history` como tabla de control

### Capas observadas

- base:
  - `001_initial_schema.sql`
  - `002_extensions.sql`
- seeds base:
  - `003_seed_roles.sql`
  - `004_seed_super_admin.sql`
  - `005_seed_general_data.sql`
  - `006_seed_menu_items.sql`
  - `007_seed_role_menu_permissions.sql`
  - `008_pos_terminals_and_sessions.sql`
  - `009_seed_demo_operational_users.sql`
  - `010_seed_demo_user_roles.sql`
- inventario/productos:
  - `scripts/database/products/*.sql`
- ventas:
  - `scripts/database/sale/*.sql`
- finanzas:
  - `scripts/database/finance/migrations/*.sql`
  - `scripts/database/finance/patches/*.sql`

### Scripts auxiliares

- `backup.sh`
- `migrate.sh`
- `rollback.sh`
- `seed.sh`
- `products/run_all.sh`
- `sale/run_sales_migrations.sh`
- `finance/run_finance_migrations.sh`

## Política recomendada para PRD

## 1. Fuente única de cambios

Todo cambio estructural o de datos operativos debe quedar versionado en `scripts/database`.

No hacer cambios manuales no registrados en producción.

## 2. Tipos de script

### Base schema

Úsalo solo para:

- bootstrap de ambiente nuevo
- documentación histórica del punto de partida

No editar retrospectivamente para “simular” migraciones nuevas de PRD.

### Migrations

Úsalas para:

- nuevas tablas
- nuevas columnas
- nuevos índices
- nuevas constraints
- funciones almacenadas nuevas

Formato recomendado:

- prefijo temporal o secuencial estable
- nombre por dominio
- en post-PRD, usar `scripts/database/migrations/YYYYMMDD_description.sql`

Ejemplos actuales:

- `20260502_1015_finance_cash_closing_controls.sql`
- `20260430_1947_finance_payments_engine.sql`

### Patches

Úsalos para:

- corregir ambientes ya desplegados
- hotfixes de esquema o datos
- ajustes compatibles sin rehacer historia

Ejemplos actuales:

- `20260502_1135_finance_menu_access.sql`
- `20260502_1840_finance_cash_movements_reference_text.sql`

### Seeds

Úsalos para:

- datos de catálogo
- datos iniciales
- permisos
- menús

No mezclar seeds demo con seeds obligatorios de PRD.

## 3. Orden de ejecución recomendado

### Ambiente nuevo

1. `001_initial_schema.sql`
2. `002_extensions.sql`
3. seeds estructurales base (`003` a `010` según necesidad)
4. scripts de `products`
5. scripts de `sale`
6. `finance/migrations`
7. `finance/patches` solo si el ambiente ya requiere correcciones posteriores

### Ambiente existente

1. backup
2. revisar versión aplicada
3. ejecutar solo migraciones/patches nuevos
4. validar aplicación
5. registrar ejecución en `migrations_history`

## Checklist previo a producción

- confirmar backup lógico reciente
- confirmar ventana de mantenimiento
- validar orden exacto de scripts
- revisar dependencias entre dominios
- revisar locks esperados sobre tablas críticas
- preparar rollback operativo

## Backup y rollback

### Backup mínimo

Antes de cualquier cambio:

- backup completo de la base
- export de esquema si aplica
- snapshot del ambiente si la infraestructura lo soporta

### Rollback

El repositorio tiene `rollback.sh`, pero para PRD no debe asumirse rollback automático total.

Recomendación:

- cada migración nueva debe documentar estrategia de reversa
- preferir migraciones forward-only para cambios complejos
- en cambios destructivos, separar:
  - despliegue compatible
  - migración de datos
  - limpieza final

## Control de cambios SQL

## Convenciones recomendadas

- una responsabilidad clara por archivo
- scripts idempotentes cuando sea viable
- `IF NOT EXISTS` / `DROP ... IF EXISTS` en cambios seguros
- comentarios cortos cuando el cambio no sea obvio

## Reglas obligatorias PRD

- no modificar directamente scripts ya ejecutados en producción
- crear un archivo nuevo para cada cambio
- para cambios nuevos post-PRD, usar `run_migrations.sh`
- si el cambio afecta datos históricos, incluir validación posterior
- si afecta permisos o menú, incluir script explícito en `seeds` o `patches`

## Validaciones posteriores a migración

### Core

- login
- `GET /auth/me`
- carga de menú por rol
- resolución de contexto POS

### Inventory

- consulta de productos
- dashboard inventory
- creación/recepción de compras
- entrega/facturación de órdenes

### Sales / POS

- venta `CASH`
- venta `CREDIT`
- impacto en stock

### Finance

- apertura de caja
- pago de compra
- pago de venta
- movimientos de caja
- cierre de caja

## Riesgos actuales a vigilar

- la base ha evolucionado por dominios y parches; hay que evitar desorden de ejecución
- varios flujos críticos dependen de funciones y constraints financieras recientes
- menú/permisos también forman parte del despliegue y no solo el código

## Recomendación operativa inmediata

Para entrar a PRD con control:

1. consolidar inventario de scripts aplicados por ambiente
2. registrar un orden oficial de ejecución por dominio
3. separar seeds demo de seeds obligatorios
4. exigir que toda nueva funcionalidad SQL viva en `scripts/database`
5. documentar en cada PR qué scripts nuevos deben ejecutarse
