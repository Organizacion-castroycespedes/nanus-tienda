-- V076 predates the staged FactuCore contract. Extend the existing check
-- without changing any document data or status.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_electronic_documents_processing_stage'
      AND conrelid = 'electronic_documents'::regclass
  ) THEN
    ALTER TABLE electronic_documents
      DROP CONSTRAINT chk_electronic_documents_processing_stage;
  END IF;

  ALTER TABLE electronic_documents
    ADD CONSTRAINT chk_electronic_documents_processing_stage
    CHECK (processing_stage IN (
      'PRE_PROVIDER_CREATE',
      'PROVIDER_CREATE_INTENT',
      'PROVIDER_LINKED',
      'XML_GENERATE_INTENT',
      'XML_GENERATED',
      'SIGN_INTENT',
      'SIGNED',
      'PRE_TRANSMIT',
      'TRANSMISSION_INTENT',
      'TRANSMITTED',
      'RECONCILIATION_REQUIRED',
      'COMPLETED',
      'UNKNOWN'
    ));
END $$;
