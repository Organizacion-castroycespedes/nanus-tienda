# Propuesta: dian-terceros-clientes-proveedores-fe-3

## Resumen

Disenar el flujo funcional y tecnico para consultar, validar y guardar terceros fiscales ante DIAN o fuente fiscal configurada, cubriendo customers, suppliers y POS.

Esta propuesta no implementa DIAN real, SOAP real nuevo, SQL funcional ni cambios de POS venta. Solo documenta el diseno y deja OpenSpec listo para fases posteriores.

## Contexto

El proyecto ya tiene:

- `customers` como entidad canonica para POS, ventas y pedidos.
- `suppliers` como entidad canonica para compras e inventario.
- Endpoints legacy `/api/customers` y `/api/suppliers`.
- Modulo `api/src/modules/electronic-invoicing` con endpoints fiscales para customers, suppliers y tipos documento.
- `backend-facturacion-electronica` con `MOCK_LOCAL`, sync mock, base `DIAN_DIRECT`, fixtures SOAP y bloqueo de llamadas externas.

POS hoy selecciona `customerId` desde `/api/customers`, busca "Consumidor Final" por nombre como fallback y exige `selectedCustomerId` antes de vender. La venta se valida por tenant y customer activo.

## Problema

La plataforma todavia no tiene diseno unificado para:

- Consultar DIAN o fuente fiscal desde POS, customers y suppliers.
- Mostrar preview y diferencias antes de guardar.
- Evitar sobrescritura automatica de datos manuales.
- Mantener Consumidor Final sin bloquear ventas.
- Manejar terceros que son customer y supplier a la vez.
- Diferenciar GetAcquirer para adquirientes de fuentes provider-agnostic para proveedores.
- Definir endpoints futuros, fases, riesgos y decisiones pendientes.

## Objetivo

Definir el diseno de terceros fiscales para:

- modulo customers;
- modulo suppliers;
- POS al seleccionar o crear cliente antes de vender;
- integracion futura GetAcquirer con `identificationType` e `identificationNumber`;
- modos `MOCK_LOCAL`, `HABILITACION` y `PRODUCCION`;
- seguridad, certificados, WS-Security y logs seguros.

## Alcance

Incluye:

- Documento `docs/diseno-dian-terceros-clientes-proveedores-fe-3-1.md`.
- OpenSpec `dian-third-party-lookup`.
- Flujos POS, customers y suppliers.
- Modelo recomendado y opcion futura de tercero fiscal comun.
- Endpoints propuestos.
- Fases FE-3.2 a FE-3.6.
- Riesgos y decisiones pendientes.

## Fuera de alcance

No incluye:

- DIAN real.
- SOAP real nuevo.
- Certificados reales.
- Cambios en pricing.
- Cambios en POS venta core.
- Cambios en Orders.
- SQL funcional o migraciones.
- Cambios de PRD real.
- Remoto.
- Commit.

## Criterios de aceptacion

1. Existe `docs/diseno-dian-terceros-clientes-proveedores-fe-3-1.md`.
2. Existe `openspec/changes/dian-terceros-clientes-proveedores-fe-3/`.
3. La spec incluye requirements para POS, customers, suppliers, GetAcquirer, seguridad y no overwrite.
4. `openspec.cmd validate dian-terceros-clientes-proveedores-fe-3 --strict` pasa.
5. `git diff --check` pasa.
6. No se modifican archivos funcionales de `api/`, `web/`, `backend-reporteria`, pricing, Orders, POS venta ni SQL.
