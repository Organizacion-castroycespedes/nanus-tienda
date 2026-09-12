#!/usr/bin/env bash
set -euo pipefail

# Safe by default: report only. Writes require an explicit QA confirmation.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${1:-${DB_ENV_FILE:-${SCRIPT_DIR}/../config/db.env}}"
MODE="${2:---dry-run}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing DB env file: $ENV_FILE" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"
: "${DB_HOST:?Missing DB_HOST}"
: "${DB_PORT:?Missing DB_PORT}"
: "${DB_NAME:?Missing DB_NAME}"
: "${DB_USER:?Missing DB_USER}"
: "${DB_PASSWORD:?Missing DB_PASSWORD}"

if [[ "$MODE" != "--dry-run" && "$MODE" != "--apply-qa" ]]; then
  echo "Usage: $0 <db.env> [--dry-run|--apply-qa]" >&2
  exit 2
fi
if [[ "$MODE" == "--apply-qa" && "${ENVIRONMENT:-}" != "qa" && "${ENVIRONMENT:-}" != "QA" ]]; then
  echo "Refusing write: ENVIRONMENT must be QA." >&2
  exit 3
fi

export PGPASSWORD="$DB_PASSWORD"
PSQL=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -X -q)

if [[ "$MODE" == "--dry-run" ]]; then
  "${PSQL[@]}" -f "${SCRIPT_DIR}/fiscal_data_backfill_dry_run.sql"
  exit 0
fi

# Only deterministic catalog-derived geographic fields are changed. Fiscal
# values are never inferred or defaulted by this script.
"${PSQL[@]}" <<'SQL'
BEGIN;
DO $$
BEGIN
  IF current_database() NOT LIKE '%qa%' THEN
    RAISE EXCEPTION 'Refusing backfill outside QA database';
  END IF;
END $$;

UPDATE public.customers c
   SET country_code = p.codigo_iso2,
       department_code = d.codigo_dane,
       municipality_code = m.codigo_dane,
       departamento = d.nombre,
       ciudad = m.nombre,
       updated_at = now()
  FROM public.municipios m
  JOIN public.departamentos d ON d.id = m.departamento_id
  JOIN public.paises p ON p.id = d.pais_id
 WHERE c.municipio_id = m.id
   AND (c.country_code IS DISTINCT FROM p.codigo_iso2
     OR c.department_code IS DISTINCT FROM d.codigo_dane
     OR c.municipality_code IS DISTINCT FROM m.codigo_dane
     OR c.departamento IS DISTINCT FROM d.nombre
     OR c.ciudad IS DISTINCT FROM m.nombre);

UPDATE public.suppliers s
   SET country_code = p.codigo_iso2,
       department_code = d.codigo_dane,
       municipality_code = m.codigo_dane,
       departamento = d.nombre,
       ciudad = m.nombre,
       updated_at = now()
  FROM public.municipios m
  JOIN public.departamentos d ON d.id = m.departamento_id
  JOIN public.paises p ON p.id = d.pais_id
 WHERE s.municipio_id = m.id
   AND (s.country_code IS DISTINCT FROM p.codigo_iso2
     OR s.department_code IS DISTINCT FROM d.codigo_dane
     OR s.municipality_code IS DISTINCT FROM m.codigo_dane
     OR s.departamento IS DISTINCT FROM d.nombre
     OR s.ciudad IS DISTINCT FROM m.nombre);

COMMIT;
SQL
