ALTER TABLE payment_methods
  ADD COLUMN IF NOT EXISTS electronic_billing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS electronic_payment_means_code VARCHAR(16),
  ADD COLUMN IF NOT EXISTS electronic_payment_means_id VARCHAR(16);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_methods_electronic_fiscal_pair_check'
  ) THEN
    ALTER TABLE payment_methods
      ADD CONSTRAINT payment_methods_electronic_fiscal_pair_check CHECK (
        electronic_billing_enabled = FALSE
        OR (
          electronic_payment_means_code IN ('10', '47', '49')
          AND electronic_payment_means_id = '1'
        )
      );
  END IF;
END $$;

UPDATE payment_methods
SET electronic_billing_enabled = TRUE,
    electronic_payment_means_code = CASE codigo
      WHEN '001' THEN '10'
      WHEN '002' THEN '47'
      WHEN '003' THEN '49'
    END,
    electronic_payment_means_id = '1'
WHERE codigo IN ('001', '002', '003');

CREATE INDEX IF NOT EXISTS idx_payment_methods_electronic_billing
  ON payment_methods(tenant_id, electronic_billing_enabled);
