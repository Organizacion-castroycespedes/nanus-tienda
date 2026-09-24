# Matriz de configuración por ambiente

Solo se documentan nombres de variables, valores no sensibles y puertos declarados. Los valores efectivos de QA y producción no fueron consultados.

| Área | Local host | Docker local | QA PM2 | Producción declarada |
|---|---|---|---|---|
| API | `PORT=4000` por default de código; `.env.example` propone `4020` | `4020:4020` | `4020` | `4020` según smoke |
| Reportería | `.env.example` propone `4021` | `4021:4021` | `4021` | `4021` |
| Facturación | `.env.example` propone `4030` | `4030:4030` | `4022` | `4022` |
| PostgreSQL API | `DB_HOST`, `DB_PORT`, `DB_DATABASE` | `host.docker.internal`, puerto externo declarado por `DB_PORT` | Variables del host | Variables del host |
| PostgreSQL reportería | `DB_HOST`, `DB_PORT`, `DB_NAME` o `DB_DATABASE` | `host.docker.internal` | No fijadas en `ecosystem.qa.config.js` | No fijadas en script |
| PostgreSQL fiscal | `DB_HOST`, `DB_PORT`, `DB_DATABASE` | `host.docker.internal`; default compose `manus_tienda_qa` | No fijadas en PM2 | No fijadas en script |
| Outbox dispatcher | Desactivado por `.env.example` | Desactivado por default compose | No demostrado en PM2 | No demostrado en script |
| Fiscal provider | `MOCK_LOCAL` en ejemplo fiscal | `MOCK_LOCAL` por default | No fijado en PM2 | No fijado en script |
| Fiscal background worker | Desactivado en ejemplo fiscal | Activado por default compose | No fijado en PM2 | No fijado en script |

Fuentes: [API env](../../api/.env.example#L1-L61), [reportería env](../../backend-reporteria/.env.example#L1-L17), [fiscal env](../../backend-facturacion-electronica/.env.example#L1-L49), [compose](../../docker-compose.yml#L8-L114), [PM2 QA](../../scripts/pm2/ecosystem.qa.config.js#L1-L57).

## Diferencias importantes

1. Facturación usa `4030` en Docker local, pero `4022` en QA y producción declarados.
2. Compose puede usar una base fiscal separada (`BILLING_DB_DATABASE`) y no prueba que API, reportería y fiscal apunten a la misma instancia.
3. `REPORTS_API_BASE_URL` existe en API, pero el código revisado de reportería consulta PostgreSQL directamente. No se certifica que esa URL sea usada por todos los flujos.
4. `INTEGRATION_OUTBOX_DISPATCHER_ENABLED` está desactivado en `.env.example` y por default del compose; la entrega fiscal automática no se deduce de la mera presencia del código.
5. La configuración declarada contiene nombres de variables para tokens, contraseñas, certificados y claves; sus valores fueron excluidos.
