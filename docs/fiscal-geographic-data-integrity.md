# Integridad fiscal y geográfica

## Fuente canónica

La ubicación se resuelve desde `public.paises`, `public.departamentos` y
`public.municipios`. La relación es `paises.id -> departamentos.pais_id ->
municipios.departamento_id`. Los códigos canónicos son `paises.codigo_iso2`,
`departamentos.codigo_dane` y `municipios.codigo_dane`.

`LocationsService.resolveCanonicalLocation()` recibe los IDs de catálogo,
comprueba toda la jerarquía y devuelve los códigos. Los códigos enviados por
el cliente no son fuente de verdad. `departamento_id` y `municipio_id` se
conservan para compatibilidad; el país se deriva de la jerarquía y no se
duplica en las tablas de terceros.

## Perfil fiscal

Los clientes normales y proveedores nuevos requieren `person_type`,
`tax_regime` y al menos una responsabilidad fiscal no vacía. Consumidor Final
mantiene la excepción ya existente. No se asigna `R-99-PN` automáticamente.
El catálogo de responsabilidades no existe todavía en estas tablas, por eso
la API valida estructura y no inventa códigos; la validación de catálogo DIAN
queda para una evolución posterior con fuente autorizada.

## Backfill seguro

`scripts/database/fiscal_data_backfill_dry_run.sql` es un informe de solo
lectura. Clasifica geometría determinista separada de perfil fiscal y no
actualiza filas. No se creó migración: las columnas y catálogos ya existen.
Con el inventario QA actual, la mayoría de filas carece de perfil fiscal
autoritativo; esas filas requieren revisión humana. No se ejecutó backfill QA.

La elegibilidad de facturación electrónica continúa fallando cerrada cuando
faltan códigos geográficos o perfil fiscal canónico. El snapshot electrónico
usa esos valores persistidos, nunca nombres libres ni el maestro mutable.
