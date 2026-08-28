CREATE TABLE IF NOT EXISTS integration_outbox_events (
  id uuid PRIMARY KEY,
  event_id text NOT NULL,
  event_type text NOT NULL,
  schema_version integer NOT NULL,
  tenant_id uuid NOT NULL,
  correlation_id text NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  payload jsonb NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT NOW(),
  lease_until timestamptz NULL,
  last_attempt_at timestamptz NULL,
  published_at timestamptz NULL,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT integration_outbox_events_event_id_key UNIQUE (event_id),
  CONSTRAINT integration_outbox_events_status_check
    CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED')),
  CONSTRAINT integration_outbox_events_attempt_count_check
    CHECK (attempt_count >= 0)
);

CREATE INDEX IF NOT EXISTS integration_outbox_events_dispatch_idx
  ON integration_outbox_events (
    status,
    next_attempt_at,
    lease_until,
    created_at,
    id
  );

CREATE INDEX IF NOT EXISTS integration_outbox_events_source_idx
  ON integration_outbox_events (
    tenant_id,
    source_type,
    source_id
  );

CREATE INDEX IF NOT EXISTS integration_outbox_events_tenant_status_idx
  ON integration_outbox_events (
    tenant_id,
    status,
    next_attempt_at
  );
