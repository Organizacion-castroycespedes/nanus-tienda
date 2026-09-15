-- Read-only report for fiscal/geographic remediation.
-- This file is intentionally not a numbered migration. It never writes data.
-- Run against the intended database only after checking DB_NAME and current_user.

SELECT current_database() AS database_name,
       current_schema() AS schema_name,
       current_user AS database_user;

WITH customer_audit AS (
  SELECT c.*,
         (p.id IS NOT NULL AND d.id IS NOT NULL AND m.id IS NOT NULL) AS hierarchy_resolvable,
         (c.country_code IS NOT NULL AND c.department_code IS NOT NULL AND c.municipality_code IS NOT NULL) AS location_complete,
         (c.person_type IS NOT NULL AND c.person_type <> 'UNKNOWN') AS person_type_complete,
         (NULLIF(c.tax_regime, '') IS NOT NULL) AS tax_regime_complete,
         (CASE WHEN jsonb_typeof(c.tax_responsibilities) = 'array' THEN jsonb_array_length(c.tax_responsibilities) ELSE 0 END > 0) AS responsibilities_complete
    FROM public.customers c
    LEFT JOIN public.municipios m ON m.id = c.municipio_id
    LEFT JOIN public.departamentos d ON d.id = COALESCE(c.departamento_id, m.departamento_id)
    LEFT JOIN public.paises p ON p.id = d.pais_id
)
SELECT 'customers' AS entity,
       count(*) AS total,
       count(*) FILTER (WHERE hierarchy_resolvable AND country_code IS NULL) AS country_code_auto_resolvable,
       count(*) FILTER (WHERE hierarchy_resolvable AND department_code IS NULL) AS department_code_auto_resolvable,
       count(*) FILTER (WHERE hierarchy_resolvable AND municipality_code IS NULL) AS municipality_code_auto_resolvable,
       count(*) FILTER (WHERE NOT hierarchy_resolvable AND country_code IS NULL) AS country_code_unresolved,
       count(*) FILTER (WHERE NOT hierarchy_resolvable AND department_code IS NULL) AS department_code_unresolved,
       count(*) FILTER (WHERE NOT hierarchy_resolvable AND municipality_code IS NULL) AS municipality_code_unresolved,
       count(*) FILTER (WHERE NOT person_type_complete) AS person_type_requires_review,
       count(*) FILTER (WHERE NOT tax_regime_complete) AS tax_regime_requires_review,
       count(*) FILTER (WHERE NOT responsibilities_complete) AS responsibilities_requires_review,
       count(*) FILTER (WHERE location_complete AND person_type_complete AND tax_regime_complete AND responsibilities_complete) AS complete_profile
  FROM customer_audit;
WITH supplier_audit AS (
  SELECT s.*,
         (p.id IS NOT NULL AND d.id IS NOT NULL AND m.id IS NOT NULL) AS hierarchy_resolvable,
         (s.country_code IS NOT NULL AND s.department_code IS NOT NULL AND s.municipality_code IS NOT NULL) AS location_complete,
         (s.person_type IS NOT NULL AND s.person_type <> 'UNKNOWN') AS person_type_complete,
         (NULLIF(s.tax_regime, '') IS NOT NULL) AS tax_regime_complete,
         (CASE WHEN jsonb_typeof(s.tax_responsibilities) = 'array' THEN jsonb_array_length(s.tax_responsibilities) ELSE 0 END > 0) AS responsibilities_complete
    FROM public.suppliers s
    LEFT JOIN public.municipios m ON m.id = s.municipio_id
    LEFT JOIN public.departamentos d ON d.id = COALESCE(s.departamento_id, m.departamento_id)
    LEFT JOIN public.paises p ON p.id = d.pais_id
)
SELECT 'suppliers' AS entity,
       count(*) AS total,
       count(*) FILTER (WHERE hierarchy_resolvable AND country_code IS NULL) AS country_code_auto_resolvable,
       count(*) FILTER (WHERE hierarchy_resolvable AND department_code IS NULL) AS department_code_auto_resolvable,
       count(*) FILTER (WHERE hierarchy_resolvable AND municipality_code IS NULL) AS municipality_code_auto_resolvable,
       count(*) FILTER (WHERE NOT hierarchy_resolvable AND country_code IS NULL) AS country_code_unresolved,
       count(*) FILTER (WHERE NOT hierarchy_resolvable AND department_code IS NULL) AS department_code_unresolved,
       count(*) FILTER (WHERE NOT hierarchy_resolvable AND municipality_code IS NULL) AS municipality_code_unresolved,
       count(*) FILTER (WHERE NOT person_type_complete) AS person_type_requires_review,
       count(*) FILTER (WHERE NOT tax_regime_complete) AS tax_regime_requires_review,
       count(*) FILTER (WHERE NOT responsibilities_complete) AS responsibilities_requires_review,
       count(*) FILTER (WHERE location_complete AND person_type_complete AND tax_regime_complete AND responsibilities_complete) AS complete_profile
  FROM supplier_audit;

-- Row-level review classification. No fiscal value is inferred here.
SELECT 'customer' AS entity, id, tenant_id,
       CASE WHEN (departamento_id IS NOT NULL AND municipio_id IS NOT NULL)
                  AND person_type IS NOT NULL AND person_type <> 'UNKNOWN'
                  AND NULLIF(tax_regime, '') IS NOT NULL
                  AND CASE WHEN jsonb_typeof(tax_responsibilities) = 'array' THEN jsonb_array_length(tax_responsibilities) ELSE 0 END > 0
            THEN 'AUTO_RESOLVABLE_GEOGRAPHY_ONLY'
            ELSE 'REQUIRES_FISCAL_REVIEW'
       END AS classification
  FROM public.customers
UNION ALL
SELECT 'supplier' AS entity, id, tenant_id,
       CASE WHEN (departamento_id IS NOT NULL AND municipio_id IS NOT NULL)
                  AND person_type IS NOT NULL AND person_type <> 'UNKNOWN'
                  AND NULLIF(tax_regime, '') IS NOT NULL
                  AND CASE WHEN jsonb_typeof(tax_responsibilities) = 'array' THEN jsonb_array_length(tax_responsibilities) ELSE 0 END > 0
            THEN 'AUTO_RESOLVABLE_GEOGRAPHY_ONLY'
            ELSE 'REQUIRES_FISCAL_REVIEW'
       END AS classification
  FROM public.suppliers;
