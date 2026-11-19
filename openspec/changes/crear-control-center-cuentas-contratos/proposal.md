## Why

El SUPER_ADMIN necesita registrar a quién le vende MANUS, a qué tenant existente corresponde, qué plan contrató y en qué condiciones. La propuesta comercial vigente (noviembre de 2026) fija:

- plan anual de $850.000 COP con 1 terminal POS;
- renovación de $99.900/mes o $850.000/año;
- terminal adicional de $29.900/mes o $350.000/año;
- bono de renovación anual con la certificación incluida (certificado de resolución DIAN, hoy $119.000/año).

Los precios cambiarán, así que deben versionarse sin alterar los contratos firmados.

Decisiones del propietario: se cobran terminales POS; una cuenta comercial puede tener varios tenants y un tenant solo una cuenta activa; el IVA se configura igual que en la venta POS (impuesto de la tabla `taxes` del tenant plataforma, hoy IVA 19% incluido en el precio); la prueba estándar es de 1 mes; el día de corte es el día de inicio del contrato; habrá prorrateo.

## What Changes

- Directorio de tenants de solo lectura con sucursales activas y terminales POS activas por tenant, y el estado de su vínculo comercial.
- CRUD de cuentas comerciales (pagador, NIT, contactos, correo de facturación y teléfono WhatsApp con consentimiento), con vínculo y desvínculo a tenants existentes.
- Catálogo de planes con versiones de precio inmutables por componente (término inicial, renovación, terminal POS adicional, certificación DIAN), por frecuencia (mensual/anual), con impuesto de la tabla `taxes` del tenant plataforma, indicador de precio con impuesto incluido, terminales incluidas y meses de prueba por defecto.
- Contratos por tenant con versiones inmutables que fijan precios y condiciones: frecuencia de cobro, día de corte, prueba, política de prorrateo, IVA e ítems contratados (base, terminales POS adicionales, ítems personalizados como sede adicional o certificación).
- Ciclo de vida del contrato: `DRAFT` → `ACTIVE` → `ENDED`, `CANCELLED` desde `DRAFT`, y enmienda mediante nueva versión.
- Indicador informativo de terminales POS contratadas frente a activas, sin bloqueo.
- Pantallas web del Control Center para directorio, cuentas, planes y contratos.
- Todas las escrituras quedan auditadas; las acciones críticas exigen motivo.

## Capabilities

### New Capabilities

- `control-center-tenant-directory`
- `control-center-commercial-accounts`
- `control-center-plan-catalog`
- `control-center-contracts`

### Modified Capabilities

- Ninguna.

## Impact

- Migración `V###__control_center_accounts_contracts.sql` y su rollback.
- `api/src/modules/control-center/{tenant-directory,accounts,catalog,contracts}/**`.
- `web/app/[tenant]/control-center/**`, `web/modules/control-center/**`.
- `scripts/governance/openspec-scope.json`.
- Depende de: `habilitar-plataforma-control-center` (esquema, rol, guard, auditoría).
- Fuera de alcance:
  - generación de cargos, pagos y cartera (Fase 2);
  - correo, WhatsApp y avisos en el panel (Fase 3);
  - entitlements con bloqueo y suspensión (Fase 4);
  - facturación electrónica de MANUS;
  - analítica e IA.
