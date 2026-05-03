ALTER TABLE cash_movements
  ALTER COLUMN reference_id TYPE VARCHAR(120)
  USING reference_id::text;
