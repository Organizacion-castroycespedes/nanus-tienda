ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS supplier_invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS supplier_invoice_date DATE;

COMMENT ON COLUMN purchases.supplier_invoice_number IS 'Invoice number issued by the supplier at receipt time.';
COMMENT ON COLUMN purchases.supplier_invoice_date IS 'Invoice date issued by the supplier.';
