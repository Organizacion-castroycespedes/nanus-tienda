# Proposal: extraer bounded context de facturacion electronica a backend dedicado

## Problema

La logica de facturacion electronica vive hoy dentro de `api/` y ya incluye:

- construccion de comandos canonicos;
- persistencia del dominio `electronic_*`;
- resolucion de provider;
- adaptador FactuCore;
- procesamiento en background;
- retry y recovery;
- mapeo de sale a snapshot fiscal.

Eso acopla el backend operativo de ventas con un bounded context fiscal que deberia evolucionar por separado.

Al mismo tiempo, ya existe `backend-facturacion-electronica/` como servicio NestJS dedicado, pero aun no posee la base de persistencia ni el contrato de consumo necesario para recibir el dominio electronico.

## Objetivo

Separar responsabilidades de forma segura:

- `api/` sigue siendo dueño de la transaccion de negocio y de la venta.
- `backend-facturacion-electronica/` pasa a ser dueño del ciclo fiscal electronico.
- la integracion entre ambos se hace mediante evento durable y consumo idempotente.

## Cambio propuesto

- Definir un boundary explicito para facturacion electronica.
- Introducir un contrato de integracion versionado entre API y billing backend.
- Añadir outbox transaccional en API para no perder eventos fiscales.
- Preparar runtime y foundation de base de datos en `backend-facturacion-electronica/`.
- Mover gradualmente contratos, repositorios, servicios y adaptadores de billing al backend dedicado.

## Non-goals

- No cambiar a base de datos separada en esta fase.
- No introducir Kafka, RabbitMQ, SQS ni otro broker externo.
- No implementar credenciales reales.
- No integrar devoluciones / credit notes todavia.
- No tocar frontend.
- No implementar E2E real con FactuCore todavia.

## Resultados esperados

- API publica un evento durable de `SaleCompletedForElectronicBilling`.
- Billing backend consume el evento y crea/actualiza su dominio fiscal.
- Solo un runtime posee el worker de facturacion electronica en cada ambiente.
- El ownership de `electronic_*` queda claramente en billing backend.
- La facturacion electronica deja de depender de `SaleService` internamente.

