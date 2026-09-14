ALTER TABLE electronic_billing_inbox_events
  DROP CONSTRAINT IF EXISTS uq_electronic_billing_inbox_events_source;

CREATE UNIQUE INDEX IF NOT EXISTS uq_electronic_billing_inbox_events_active_source
  ON electronic_billing_inbox_events (tenant_id, source_type, source_id)
  WHERE status IN ('RECEIVED', 'PROCESSED');
