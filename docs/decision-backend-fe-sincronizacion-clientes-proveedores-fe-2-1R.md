# Decision backend FE sincronizacion clientes/proveedores - FE-2.1R

## Decision

`backend-facturacion-electronica/` sera la capa especializada de consulta, normalizacion y sincronizacion fiscal de terceros.

La responsabilidad cubre:

- customers/adquirientes.
- suppliers/proveedores.
- lookup provider-agnostic.
- normalizacion de datos fiscales.
- sync idempotente hacia `api/`.
- logs seguros de consulta y sincronizacion.

`api/` conserva las tablas operativas `customers` y `suppliers`. Backend FE no crea tablas paralelas como fuente principal.

## Justificacion

Facturacion electronica necesita datos fiscales confiables de terceros. Esos datos pueden venir de DIAN, proveedor tecnologico, fuente manual, RUT u otra fuente aprobada.

Separar lookup/sync fiscal en backend FE evita meter dependencias externas, certificados, timeouts y logs tecnicos dentro de POS, compras o inventario.

Mantener `customers` y `suppliers` en `api/` evita romper contratos actuales:

- POS usa `customers`.
- Ventas y pedidos usan `customerId`.
- Compras e inventario usan `supplierId`.
- Frontend y reportes actuales esperan las tablas operativas.

## Impacto en `api/`

`api/` sigue siendo owner operativo de:

- `/api/customers`.
- `/api/suppliers`.
- ventas.
- pedidos.
- compras.
- pagos.
- inventario.
- validaciones tenant-aware.
- auditoria funcional.

En fases futuras, `api/` debera exponer comandos internos seguros para upsert fiscal:

- crear o actualizar customer desde backend FE.
- crear o actualizar supplier desde backend FE.
- validar tenant, duplicados y permisos internos.
- auditar before/after.
- aplicar politica de no sobrescritura.

No se implementa nada en FE-2.1R.

## Impacto en `backend-facturacion-electronica/`

Backend FE sera owner de:

- adapters de lookup fiscal.
- normalizacion fiscal.
- idempotencia por `tenantId + partyType + documentType + documentNumber`.
- logs seguros de lookup y sync.
- resumen operativo de respuestas.
- correlation id y request hash.

Backend FE no debe escribir directo a tablas operativas si eso salta reglas de `api/`. La integracion recomendada es llamar endpoints/comandos internos de `api/`.

## Impacto en `customers`

`customers` sigue siendo tabla canonica del cliente/adquiriente.

Si el customer existe:

- backend FE consulta y normaliza datos.
- backend FE solicita actualizar solo campos permitidos.
- `api/` valida y audita.

Si el customer no existe:

- backend FE solicita crearlo en `customers`.
- `api/` crea un customer compatible con POS, ventas y `/api/customers`.

GetAcquirer se considera fuente candidata para adquirientes/clientes. La guia DIAN de consumo de Web Services describe GetAcquirer como servicio para completar informacion de adquirientes y usa `identificationType` e `identificationNumber` como entrada.

Referencia: [DIAN - Guia Herramienta para el Consumo de Web Services](https://www.dian.gov.co/impuestos/factura-electronica/Documents/Guia-Herramienta-para-el-Consumo-de-Web-Services.pdf).

## Impacto en `suppliers`

`suppliers` sigue siendo tabla canonica del proveedor operativo.

Si el supplier existe:

- backend FE consulta fuente fiscal provider-agnostic.
- backend FE normaliza datos.
- backend FE solicita actualizar solo campos permitidos.
- `api/` valida y audita.

Si el supplier no existe:

- backend FE solicita crearlo en `suppliers`.
- `api/` crea proveedor compatible con compras e inventario.

Para suppliers no se asume GetAcquirer como fuente unica. La fuente puede ser proveedor tecnologico, RUT, captura manual validada u otra integracion aprobada.

## Riesgos

| Riesgo | Mitigacion |
| --- | --- |
| Duplicar customers o suppliers | Idempotencia por tenant, tipo y numero normalizado. |
| Sobrescribir datos manuales correctos | Politica de campos permitidos, preview y auditoria before/after. |
| Exponer datos personales | Guardar solo resumen seguro, request hash y response summary. |
| Usar GetAcquirer fuera de alcance | Limitar GetAcquirer a adquirientes/customers hasta confirmar soporte para otros casos. |
| Acoplar backend FE al schema interno de `api/` | Usar comandos internos versionados en vez de escritura directa. |
| Suppliers no tienen campos fiscales suficientes | Disenar evolucion aditiva en FE-2.3 antes de migrar. |

## Preguntas abiertas

1. Cual sera el contrato exacto de upsert interno para `customers`?
2. Cual sera el contrato exacto de upsert interno para `suppliers`?
3. `suppliers` recibira columnas fiscales equivalentes a `customers`?
4. Que fuente fiscal se aprobara para proveedores?
5. Que campos puede sobrescribir una fuente externa sin confirmacion humana?
6. Donde se almacenan logs de sync fiscal: backend FE, `api/` o ambos?
7. Que retencion aplica a logs de terceros?
8. Como se resolveran conflictos si ya existen duplicados por documento?

## Fases siguientes

| Fase | Alcance |
| --- | --- |
| FE-2.2 | Prueba API local clientes FE actuales. |
| FE-2.3 | Diseno sync fiscal customers/suppliers. |
| FE-2.4 | Scaffolding `backend-facturacion-electronica/`. |
| FE-2.5 | Adapter mock fiscal lookup. |
| FE-2.6 | Integracion backend FE -> `api` para upsert customer/supplier. |
| FE-2.7 | Integracion GetAcquirer real para customers. |
| FE-2.8 | Estrategia proveedor fiscal para suppliers. |

## Guardrails

- No se modifica codigo funcional en esta decision.
- No se crean migraciones.
- No se crean endpoints.
- No se toca frontend.
- No se toca `backend-reporteria`.
- No se toca SQL.
- No se toca PRD.
- No se hace commit.
