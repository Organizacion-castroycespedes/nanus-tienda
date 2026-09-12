ALTER TABLE electronic_documents
  ADD COLUMN IF NOT EXISTS processing_stage TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS processing_stage_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE electronic_documents
SET processing_stage = CASE
  WHEN status IN ('ACCEPTED', 'CANCELLED') THEN 'COMPLETED'
  WHEN status = 'REJECTED' AND rejected_at IS NOT NULL THEN 'COMPLETED'
  WHEN provider_document_id IS NOT NULL THEN 'RECONCILIATION_REQUIRED'
  ELSE 'UNKNOWN'
END,
processing_stage_updated_at = COALESCE(updated_at, NOW())
WHERE processing_stage = 'UNKNOWN';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_electronic_documents_processing_stage'
      AND conrelid = 'electronic_documents'::regclass
  ) THEN
    ALTER TABLE electronic_documents
      ADD CONSTRAINT chk_electronic_documents_processing_stage
      CHECK (processing_stage IN (
        'PRE_PROVIDER_CREATE',
        'PROVIDER_CREATE_INTENT',
        'PROVIDER_LINKED',
        'PRE_TRANSMIT',
        'TRANSMISSION_INTENT',
        'RECONCILIATION_REQUIRED',
        'COMPLETED',
        'UNKNOWN'
      ));
  END IF;
END $$;
