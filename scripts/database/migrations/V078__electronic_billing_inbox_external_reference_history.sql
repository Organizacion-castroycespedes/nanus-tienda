-- external_reference identifies the business source/provider correlation.
-- event_id remains the delivery idempotency key. Historical FAILED deliveries
-- must therefore be allowed to reuse the same business external_reference.
ALTER TABLE electronic_billing_inbox_events
  DROP CONSTRAINT IF EXISTS uq_electronic_billing_inbox_events_external_reference;

CREATE INDEX IF NOT EXISTS idx_electronic_billing_inbox_events_tenant_external_reference
  ON electronic_billing_inbox_events(tenant_id, external_reference);
