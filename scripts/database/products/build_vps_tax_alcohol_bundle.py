#!/usr/bin/env python3
"""Build one-shot VPS SQL: V077-V080 + alcohol/tax seeds."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(__file__).resolve().parent / "2026_09_12_vps_tax_model_alcohol_bundle.sql"

PARTS = [
    ("migrations/V077__tax_model_extension.sql", True),
    ("migrations/V078__sale_item_taxes_multi_tax_snapshot.sql", False),
    ("migrations/V079__tax_model_prc_fnc_routines.sql", False),
    ("migrations/V080__tax_dictionaries_es_names.sql", False),
    ("products/2026_09_12_seed_inventory_taxes_and_tax_model.sql", False),
    ("products/2026_09_12_migrate_existing_alcohol_products.sql", False),
    ("products/2026_09_12_migrate_alcohol_from_excel.sql", False),
]


def strip_v077_outer_tx(text: str) -> str:
    lines = text.splitlines()
    cleaned: list[str] = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped == "BEGIN;" and i < 30:
            cleaned.append("-- [bundle] skipped outer BEGIN;")
            continue
        if stripped == "COMMIT;" and i > len(lines) - 5:
            cleaned.append("-- [bundle] skipped outer COMMIT;")
            continue
        cleaned.append(line)
    return "\n".join(cleaned) + "\n"


def read_sql(path: Path) -> str:
    # utf-8-sig strips leading BOM that breaks PostgreSQL parsers.
    return path.read_text(encoding="utf-8-sig")


def main() -> None:
    chunks: list[str] = [
        """-- =============================================================================
-- Bundle VPS: tax model multi-tax + alcohol seeds (idempotente)
-- Incluye: V077, V078, V079, V080 + seed taxes + migrate 11 alcohol + Excel
-- Uso:
--   psql -h HOST -U USER -d DB -v ON_ERROR_STOP=1 \\
--     -f scripts/database/products/2026_09_12_vps_tax_model_alcohol_bundle.sql
-- Notas:
--   * Seguro re-ejecutar en gran parte (IF NOT EXISTS / ON CONFLICT / upserts).
--   * Registra versions en migrations_history al final (ON CONFLICT DO NOTHING).
--   * Excel seed crea productos XLS-* en tenant default; comenta esa seccion si no aplica.
-- =============================================================================
"""
    ]

    for rel, is_v077 in PARTS:
        path = ROOT / rel
        if not path.exists():
            raise SystemExit(f"Missing: {path}")
        text = read_sql(path)
        if is_v077:
            text = strip_v077_outer_tx(text)
        chunks.append(f"\n-- >>> BEGIN SECTION: {rel}\n")
        chunks.append(text if text.endswith("\n") else text + "\n")
        chunks.append(f"-- <<< END SECTION: {rel}\n")

    chunks.append(
        """
-- =============================================================================
-- Register incremental migrations (same keys as migrate_prd.sh ONLY_INCREMENTAL)
-- =============================================================================
INSERT INTO public.migrations_history (version, checksum, success, details, execution_time_ms)
VALUES
  ('V077__tax_model_extension.sql', 'bundle-2026-09-12', true, 'applied by 2026_09_12_vps_tax_model_alcohol_bundle.sql', NULL),
  ('V078__sale_item_taxes_multi_tax_snapshot.sql', 'bundle-2026-09-12', true, 'applied by 2026_09_12_vps_tax_model_alcohol_bundle.sql', NULL),
  ('V079__tax_model_prc_fnc_routines.sql', 'bundle-2026-09-12', true, 'applied by 2026_09_12_vps_tax_model_alcohol_bundle.sql', NULL),
  ('V080__tax_dictionaries_es_names.sql', 'bundle-2026-09-12', true, 'applied by 2026_09_12_vps_tax_model_alcohol_bundle.sql', NULL)
ON CONFLICT (version) DO NOTHING;
"""
    )

    # Write UTF-8 without BOM (PostgreSQL rejects U+FEFF).
    OUT.write_bytes("".join(chunks).encode("utf-8"))
    print(f"Wrote {OUT} bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
