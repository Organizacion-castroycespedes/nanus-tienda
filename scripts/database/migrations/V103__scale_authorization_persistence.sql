-- DEV_TO_QA-only persistence identity. Historical QA V094/V095 are not replayed.
-- STATE A: both legacy tables are absent in current DEV. STATE B: both exact,
-- known_shape historical QA tables exist and are empty. No other state is adopted.
DO $$
DECLARE
  credentials_exists boolean := to_regclass('public.terminal_device_credentials') IS NOT NULL;
  bindings_exists boolean := to_regclass('public.terminal_scale_bindings') IS NOT NULL;
  relation_name text;
BEGIN
  IF credentials_exists IS DISTINCT FROM bindings_exists THEN
    RAISE EXCEPTION 'SCALE_AUTH_UNKNOWN_TABLE_STATE: credential/binding tables must both exist or both be absent';
  END IF;
  IF to_regclass('public.terminal_scale_weight_captures') IS NOT NULL THEN
    RAISE EXCEPTION 'SCALE_AUTH_UNKNOWN_CAPTURE_TABLE_STATE';
  END IF;
  IF to_regprocedure('public.reject_terminal_scale_binding_identity_change()') IS NOT NULL
    OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_terminal_scale_binding_identity_immutable' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'SCALE_AUTH_IDENTITY_GUARD_NAME_COLLISION';
  END IF;
  IF to_regprocedure('public.set_updated_at_timestamp()') IS NULL THEN
    RAISE EXCEPTION 'SCALE_AUTH_REQUIRED_UPDATED_AT_FUNCTION_MISSING';
  END IF;
  FOREACH relation_name IN ARRAY ARRAY[
    'public.tenants','public.tenant_branches','public.pos_terminals','public.terminals',
    'public.terminal_devices','public.users','public.pos_user_sessions','public.products','public.sales'
  ] LOOP
    IF to_regclass(relation_name) IS NULL THEN
      RAISE EXCEPTION 'SCALE_AUTH_REQUIRED_RELATION_MISSING: %', relation_name;
    END IF;
  END LOOP;

  IF credentials_exists THEN
    IF EXISTS (
      SELECT 1 FROM (VALUES
        ('id','uuid',true),('tenant_id','uuid',true),('terminal_device_id','uuid',true),
        ('credential_id','text',true),('verifier_version','text',true),('verifier_sha256','text',true),
        ('status','text',true),('issued_at','timestamp with time zone',true),('expires_at','timestamp with time zone',false),
        ('rotated_at','timestamp with time zone',false),('revoked_at','timestamp with time zone',false),
        ('created_by','text',false),('revoked_by','text',false),('created_at','timestamp with time zone',true),('updated_at','timestamp with time zone',true)
      ) expected(name,type_name,required)
      LEFT JOIN pg_attribute a ON a.attrelid='public.terminal_device_credentials'::regclass AND a.attname=expected.name AND a.attnum>0 AND NOT a.attisdropped
      WHERE a.attname IS NULL OR format_type(a.atttypid,a.atttypmod) <> expected.type_name OR a.attnotnull <> expected.required
    ) THEN RAISE EXCEPTION 'SCALE_AUTH_CREDENTIAL_COLUMN_DEFINITION_INCOMPATIBLE'; END IF;
    IF (SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum WHERE d.adrelid='public.terminal_device_credentials'::regclass AND a.attname='id') IS DISTINCT FROM 'gen_random_uuid()'
      OR (SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum WHERE d.adrelid='public.terminal_device_credentials'::regclass AND a.attname='verifier_version') IS DISTINCT FROM '''sha256-v1''::text'
      OR (SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum WHERE d.adrelid='public.terminal_device_credentials'::regclass AND a.attname='status') IS DISTINCT FROM '''ACTIVE''::text' THEN
      RAISE EXCEPTION 'SCALE_AUTH_CREDENTIAL_DEFAULTS_INCOMPATIBLE';
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid='public.terminal_device_credentials'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped
        AND a.attname <> ALL (ARRAY['id','tenant_id','terminal_device_id','credential_id','verifier_version','verifier_sha256','status','issued_at','expires_at','rotated_at','revoked_at','created_by','revoked_by','created_at','updated_at'])
    ) OR EXISTS (
      SELECT 1 FROM unnest(ARRAY['id','tenant_id','terminal_device_id','credential_id','verifier_version','verifier_sha256','status','issued_at','expires_at','rotated_at','revoked_at','created_by','revoked_by','created_at','updated_at']) expected(name)
      WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.terminal_device_credentials'::regclass AND a.attname=expected.name AND a.attnum>0 AND NOT a.attisdropped)
    ) THEN RAISE EXCEPTION 'SCALE_AUTH_CREDENTIAL_SCHEMA_INCOMPATIBLE'; END IF;
    IF EXISTS (SELECT 1 FROM public.terminal_device_credentials) THEN
      RAISE EXCEPTION 'SCALE_AUTH_KNOWN_QA_CREDENTIAL_ADOPTION_REQUIRES_EMPTY_TABLE';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.terminal_device_credentials'::regclass AND conname='terminal_device_credentials_device_fk')
      OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.terminal_device_credentials'::regclass AND conname='terminal_device_credentials_status_check')
      OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.terminal_device_credentials'::regclass AND conname='terminal_device_credentials_id_not_blank')
      OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.terminal_device_credentials'::regclass AND conname='terminal_device_credentials_verifier_check')
      OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.terminal_device_credentials'::regclass AND conname='terminal_device_credentials_dates_check')
      OR to_regclass('public.terminal_device_credentials_credential_id_unique') IS NULL
      OR to_regclass('public.terminal_device_credentials_active_device_unique') IS NULL THEN
      RAISE EXCEPTION 'SCALE_AUTH_CREDENTIAL_KNOWN_CONSTRAINTS_MISSING';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.terminal_device_credentials'::regclass
      AND conname <> ALL (ARRAY['terminal_device_credentials_pkey','terminal_device_credentials_tenant_id_fkey','terminal_device_credentials_device_fk','terminal_device_credentials_status_check','terminal_device_credentials_id_not_blank','terminal_device_credentials_verifier_check','terminal_device_credentials_dates_check']))
      OR EXISTS (SELECT 1 FROM pg_class i JOIN pg_index ix ON ix.indexrelid=i.oid
        WHERE ix.indrelid='public.terminal_device_credentials'::regclass
          AND i.relname <> ALL (ARRAY['terminal_device_credentials_pkey','terminal_device_credentials_credential_id_unique','terminal_device_credentials_active_device_unique','terminal_device_credentials_tenant_status_idx'])) THEN
      RAISE EXCEPTION 'SCALE_AUTH_CREDENTIAL_UNEXPECTED_CONSTRAINT_OR_INDEX';
    END IF;
    IF position('terminal_device_id, tenant_id' IN pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conrelid='public.terminal_device_credentials'::regclass AND conname='terminal_device_credentials_device_fk'))) = 0
      OR position('credential_id' IN pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conrelid='public.terminal_device_credentials'::regclass AND conname='terminal_device_credentials_id_not_blank'))) = 0
      OR position('verifier_sha256' IN pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conrelid='public.terminal_device_credentials'::regclass AND conname='terminal_device_credentials_verifier_check'))) = 0
      OR position('expires_at' IN pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conrelid='public.terminal_device_credentials'::regclass AND conname='terminal_device_credentials_dates_check'))) = 0 THEN
      RAISE EXCEPTION 'SCALE_AUTH_CREDENTIAL_CONSTRAINT_DEFINITION_INCOMPATIBLE';
    END IF;
    IF position('(credential_id)' IN pg_get_indexdef(to_regclass('public.terminal_device_credentials_credential_id_unique'))) = 0
      OR position('(terminal_device_id)' IN pg_get_indexdef(to_regclass('public.terminal_device_credentials_active_device_unique'))) = 0
      OR position('status' IN pg_get_indexdef(to_regclass('public.terminal_device_credentials_active_device_unique'))) = 0 THEN
      RAISE EXCEPTION 'SCALE_AUTH_CREDENTIAL_INDEX_DEFINITION_INCOMPATIBLE';
    END IF;

    IF EXISTS (
      SELECT 1 FROM (VALUES
        ('id','uuid',true),('tenant_id','uuid',true),('branch_id','uuid',true),('pos_terminal_id','uuid',true),
        ('operational_terminal_id','uuid',true),('terminal_device_id','uuid',true),('logical_scale_id','text',true),
        ('status','text',true),('unit_state','text',true),('verified_at','timestamp with time zone',false),
        ('last_observed_at','timestamp with time zone',false),('revoked_at','timestamp with time zone',false),
        ('created_by','text',false),('revoked_by','text',false),('created_at','timestamp with time zone',true),('updated_at','timestamp with time zone',true)
      ) expected(name,type_name,required)
      LEFT JOIN pg_attribute a ON a.attrelid='public.terminal_scale_bindings'::regclass AND a.attname=expected.name AND a.attnum>0 AND NOT a.attisdropped
      WHERE a.attname IS NULL OR format_type(a.atttypid,a.atttypmod) <> expected.type_name OR a.attnotnull <> expected.required
    ) THEN RAISE EXCEPTION 'SCALE_AUTH_BINDING_COLUMN_DEFINITION_INCOMPATIBLE'; END IF;
    IF (SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum WHERE d.adrelid='public.terminal_scale_bindings'::regclass AND a.attname='id') IS DISTINCT FROM 'gen_random_uuid()'
      OR (SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum WHERE d.adrelid='public.terminal_scale_bindings'::regclass AND a.attname='status') IS DISTINCT FROM '''PENDING''::text'
      OR (SELECT pg_get_expr(d.adbin,d.adrelid) FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum WHERE d.adrelid='public.terminal_scale_bindings'::regclass AND a.attname='unit_state') IS DISTINCT FROM '''NOT_VERIFIED''::text' THEN
      RAISE EXCEPTION 'SCALE_AUTH_BINDING_DEFAULTS_INCOMPATIBLE';
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid='public.terminal_scale_bindings'::regclass
        AND a.attnum > 0 AND NOT a.attisdropped
        AND a.attname <> ALL (ARRAY['id','tenant_id','branch_id','pos_terminal_id','operational_terminal_id','terminal_device_id','logical_scale_id','status','unit_state','verified_at','last_observed_at','revoked_at','created_by','revoked_by','created_at','updated_at'])
    ) OR EXISTS (
      SELECT 1 FROM unnest(ARRAY['id','tenant_id','branch_id','pos_terminal_id','operational_terminal_id','terminal_device_id','logical_scale_id','status','unit_state','verified_at','last_observed_at','revoked_at','created_by','revoked_by','created_at','updated_at']) expected(name)
      WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.terminal_scale_bindings'::regclass AND a.attname=expected.name AND a.attnum>0 AND NOT a.attisdropped)
    ) THEN RAISE EXCEPTION 'SCALE_AUTH_BINDING_SCHEMA_INCOMPATIBLE'; END IF;
    IF EXISTS (SELECT 1 FROM public.terminal_scale_bindings) THEN
      RAISE EXCEPTION 'SCALE_AUTH_KNOWN_QA_BINDING_ADOPTION_REQUIRES_EMPTY_TABLE';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.terminal_scale_bindings'::regclass AND conname='terminal_scale_bindings_pos_fk')
      OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.terminal_scale_bindings'::regclass AND conname='terminal_scale_bindings_terminal_fk')
      OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.terminal_scale_bindings'::regclass AND conname='terminal_scale_bindings_device_fk')
      OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.terminal_scale_bindings'::regclass AND conname='terminal_scale_bindings_status_check')
      OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.terminal_scale_bindings'::regclass AND conname='terminal_scale_bindings_unit_check')
      OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.terminal_scale_bindings'::regclass AND conname='terminal_scale_bindings_id_not_blank')
      OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.terminal_scale_bindings'::regclass AND conname='terminal_scale_bindings_revoked_check')
      OR to_regclass('public.terminal_scale_bindings_active_terminal_unique') IS NULL
      OR to_regclass('public.terminal_scale_bindings_active_scale_unique') IS NULL THEN
      RAISE EXCEPTION 'SCALE_AUTH_BINDING_KNOWN_CONSTRAINTS_MISSING';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.terminal_scale_bindings'::regclass
      AND conname <> ALL (ARRAY['terminal_scale_bindings_pkey','terminal_scale_bindings_tenant_id_fkey','terminal_scale_bindings_branch_id_fkey','terminal_scale_bindings_pos_fk','terminal_scale_bindings_terminal_fk','terminal_scale_bindings_device_fk','terminal_scale_bindings_status_check','terminal_scale_bindings_unit_check','terminal_scale_bindings_id_not_blank','terminal_scale_bindings_revoked_check']))
      OR EXISTS (SELECT 1 FROM pg_class i JOIN pg_index ix ON ix.indexrelid=i.oid
        WHERE ix.indrelid='public.terminal_scale_bindings'::regclass
          AND i.relname <> ALL (ARRAY['terminal_scale_bindings_pkey','terminal_scale_bindings_active_terminal_unique','terminal_scale_bindings_active_scale_unique','terminal_scale_bindings_tenant_status_idx'])) THEN
      RAISE EXCEPTION 'SCALE_AUTH_BINDING_UNEXPECTED_CONSTRAINT_OR_INDEX';
    END IF;
    IF position('pos_terminal_id, tenant_id, branch_id' IN pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conrelid='public.terminal_scale_bindings'::regclass AND conname='terminal_scale_bindings_pos_fk'))) = 0
      OR position('logical_scale_id' IN pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conrelid='public.terminal_scale_bindings'::regclass AND conname='terminal_scale_bindings_id_not_blank'))) = 0 THEN
      RAISE EXCEPTION 'SCALE_AUTH_BINDING_CONSTRAINT_DEFINITION_INCOMPATIBLE';
    END IF;
    IF position('revoked_at' IN pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conrelid='public.terminal_scale_bindings'::regclass AND conname='terminal_scale_bindings_revoked_check'))) = 0 THEN
      RAISE EXCEPTION 'SCALE_AUTH_BINDING_REVOCATION_CONSTRAINT_INCOMPATIBLE';
    END IF;
    IF position('(pos_terminal_id)' IN pg_get_indexdef(to_regclass('public.terminal_scale_bindings_active_terminal_unique'))) = 0
      OR position('status' IN pg_get_indexdef(to_regclass('public.terminal_scale_bindings_active_terminal_unique'))) = 0
      OR position('(tenant_id, logical_scale_id)' IN pg_get_indexdef(to_regclass('public.terminal_scale_bindings_active_scale_unique'))) = 0
      OR position('status' IN pg_get_indexdef(to_regclass('public.terminal_scale_bindings_active_scale_unique'))) = 0 THEN
      RAISE EXCEPTION 'SCALE_AUTH_BINDING_INDEX_DEFINITION_INCOMPATIBLE';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.terminal_device_credentials'::regclass AND NOT tgisinternal AND tgname <> 'trg_terminal_device_credentials_updated_at')
      OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.terminal_scale_bindings'::regclass AND NOT tgisinternal AND tgname <> 'trg_terminal_scale_bindings_updated_at') THEN
      RAISE EXCEPTION 'SCALE_AUTH_KNOWN_TABLE_UNEXPECTED_TRIGGER';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.terminal_device_credentials') IS NULL THEN
    CREATE TABLE public.terminal_device_credentials (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      terminal_device_id uuid NOT NULL,
      credential_id text NOT NULL,
      verifier_version text NOT NULL DEFAULT 'sha256-v1',
      verifier_sha256 text NOT NULL,
      status text NOT NULL DEFAULT 'ACTIVE',
      issued_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NULL,
      rotated_at timestamptz NULL,
      revoked_at timestamptz NULL,
      created_by text NULL,
      revoked_by text NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      rotated_by text NULL,
      CONSTRAINT terminal_device_credentials_device_fk FOREIGN KEY (terminal_device_id,tenant_id) REFERENCES public.terminal_devices(id,tenant_id) ON DELETE CASCADE,
      CONSTRAINT terminal_device_credentials_status_check CHECK (status IN ('ACTIVE','EXPIRED','ROTATED','REVOKED')),
      CONSTRAINT terminal_device_credentials_id_not_blank CHECK (btrim(credential_id) <> ''),
      CONSTRAINT terminal_device_credentials_verifier_check CHECK (verifier_version='sha256-v1' AND verifier_sha256 ~ '^[0-9a-f]{64}$'),
      CONSTRAINT terminal_device_credentials_dates_check CHECK ((expires_at IS NULL OR expires_at > issued_at) AND (status <> 'REVOKED' OR revoked_at IS NOT NULL) AND (status <> 'ROTATED' OR rotated_at IS NOT NULL)),
      CONSTRAINT terminal_device_credentials_active_expiry_check CHECK (status <> 'ACTIVE' OR expires_at IS NOT NULL)
    );
  END IF;
  IF to_regclass('public.terminal_scale_bindings') IS NULL THEN
    CREATE TABLE public.terminal_scale_bindings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      branch_id uuid NOT NULL REFERENCES public.tenant_branches(id) ON DELETE RESTRICT,
      pos_terminal_id uuid NOT NULL,
      operational_terminal_id uuid NOT NULL,
      terminal_device_id uuid NOT NULL,
      logical_scale_id text NOT NULL,
      status text NOT NULL DEFAULT 'PENDING',
      unit_state text NOT NULL DEFAULT 'NOT_VERIFIED',
      verified_at timestamptz NULL,
      last_observed_at timestamptz NULL,
      revoked_at timestamptz NULL,
      created_by text NULL,
      revoked_by text NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      unit_verification_method text NULL,
      unit_verification_unit text NULL,
      unit_verified_by_user_id uuid NULL,
      CONSTRAINT terminal_scale_bindings_pos_fk FOREIGN KEY (pos_terminal_id,tenant_id,branch_id) REFERENCES public.pos_terminals(id,tenant_id,branch_id) ON DELETE CASCADE,
      CONSTRAINT terminal_scale_bindings_terminal_fk FOREIGN KEY (operational_terminal_id,tenant_id,branch_id) REFERENCES public.terminals(id,tenant_id,branch_id) ON DELETE RESTRICT,
      CONSTRAINT terminal_scale_bindings_device_fk FOREIGN KEY (terminal_device_id,tenant_id) REFERENCES public.terminal_devices(id,tenant_id) ON DELETE RESTRICT,
      CONSTRAINT terminal_scale_bindings_status_check CHECK (status IN ('PENDING','AUTHORIZED','REVOKED','DISABLED')),
      CONSTRAINT terminal_scale_bindings_unit_check CHECK (unit_state IN ('NOT_VERIFIED','KG_VERIFIED')),
      CONSTRAINT terminal_scale_bindings_id_not_blank CHECK (btrim(logical_scale_id) <> ''),
      CONSTRAINT terminal_scale_bindings_revoked_check CHECK ((status='REVOKED' AND revoked_at IS NOT NULL) OR status <> 'REVOKED'),
      CONSTRAINT terminal_scale_bindings_authorized_requires_kg CHECK (status <> 'AUTHORIZED' OR unit_state='KG_VERIFIED')
    );
  END IF;
END $$;

-- Additive adoption after the exact known QA input shape was validated above.
ALTER TABLE public.terminal_device_credentials ADD COLUMN IF NOT EXISTS rotated_by text NULL;
ALTER TABLE public.terminal_scale_bindings ADD COLUMN IF NOT EXISTS unit_verification_method text NULL;
ALTER TABLE public.terminal_scale_bindings ADD COLUMN IF NOT EXISTS unit_verification_unit text NULL;
ALTER TABLE public.terminal_scale_bindings ADD COLUMN IF NOT EXISTS unit_verified_by_user_id uuid NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_id_id_unique ON public.users (tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_branches_tenant_id_id_unique ON public.tenant_branches (tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_id_id_unique ON public.products (tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS sales_tenant_id_id_unique ON public.sales (tenant_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS pos_user_sessions_context_unique ON public.pos_user_sessions (id,tenant_id,branch_id,terminal_id);
CREATE UNIQUE INDEX IF NOT EXISTS terminal_scale_bindings_capture_context_unique
  ON public.terminal_scale_bindings (id,tenant_id,branch_id,pos_terminal_id,operational_terminal_id,terminal_device_id,logical_scale_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.terminal_scale_bindings'::regclass AND conname='terminal_scale_bindings_kg_operator_fk') THEN
    ALTER TABLE public.terminal_scale_bindings ADD CONSTRAINT terminal_scale_bindings_kg_operator_fk
      FOREIGN KEY (tenant_id,unit_verified_by_user_id) REFERENCES public.users(tenant_id,id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.terminal_scale_bindings'::regclass AND conname='terminal_scale_bindings_kg_evidence_check') THEN
    ALTER TABLE public.terminal_scale_bindings ADD CONSTRAINT terminal_scale_bindings_kg_evidence_check CHECK (
      (unit_state='NOT_VERIFIED' AND unit_verification_method IS NULL AND unit_verification_unit IS NULL AND unit_verified_by_user_id IS NULL AND verified_at IS NULL)
      OR (unit_state='KG_VERIFIED' AND unit_verification_method='OPERATOR_CONFIRMATION' AND unit_verification_unit='kg' AND unit_verified_by_user_id IS NOT NULL AND verified_at IS NOT NULL)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.terminal_device_credentials'::regclass AND conname='terminal_device_credentials_canonical_verifier_check') THEN
    ALTER TABLE public.terminal_device_credentials ADD CONSTRAINT terminal_device_credentials_canonical_verifier_check
      CHECK (verifier_version='sha256-v1' AND verifier_sha256 ~ '^[0-9a-f]{64}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.terminal_device_credentials'::regclass AND conname='terminal_device_credentials_active_expiry_check') THEN
    ALTER TABLE public.terminal_device_credentials ADD CONSTRAINT terminal_device_credentials_active_expiry_check
      CHECK (status <> 'ACTIVE' OR expires_at IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.terminal_device_credentials'::regclass AND conname='terminal_device_credentials_rotation_actor_check') THEN
    ALTER TABLE public.terminal_device_credentials ADD CONSTRAINT terminal_device_credentials_rotation_actor_check
      CHECK (status <> 'ROTATED' OR (rotated_at IS NOT NULL AND rotated_by IS NOT NULL));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS terminal_device_credentials_credential_id_unique
  ON public.terminal_device_credentials (credential_id);
CREATE UNIQUE INDEX IF NOT EXISTS terminal_device_credentials_active_device_unique
  ON public.terminal_device_credentials (terminal_device_id) WHERE status='ACTIVE';
CREATE INDEX IF NOT EXISTS terminal_device_credentials_tenant_status_idx
  ON public.terminal_device_credentials (tenant_id,status);
CREATE UNIQUE INDEX IF NOT EXISTS terminal_scale_bindings_active_terminal_unique
  ON public.terminal_scale_bindings (pos_terminal_id) WHERE status IN ('PENDING','AUTHORIZED');
CREATE UNIQUE INDEX IF NOT EXISTS terminal_scale_bindings_active_scale_unique
  ON public.terminal_scale_bindings (tenant_id,logical_scale_id) WHERE status IN ('PENDING','AUTHORIZED');
CREATE INDEX IF NOT EXISTS terminal_scale_bindings_tenant_status_idx
  ON public.terminal_scale_bindings (tenant_id,branch_id,status);

CREATE TABLE public.terminal_scale_weight_captures (
  capture_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  pos_terminal_id uuid NOT NULL,
  operational_terminal_id uuid NOT NULL,
  pos_session_id uuid NOT NULL,
  product_id uuid NOT NULL,
  terminal_device_id uuid NOT NULL,
  logical_scale_id text NOT NULL,
  terminal_scale_binding_id uuid NOT NULL,
  nonce_verifier_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  weight_kg numeric(18,6) NULL,
  measurement_source text NULL,
  measurement_unit text NULL,
  unit_verified boolean NULL,
  observed_at timestamptz NULL,
  consumed_at timestamptz NULL,
  consumed_sale_id uuid NULL,
  consumed_by_user_id uuid NULL,
  CONSTRAINT terminal_scale_weight_captures_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT terminal_scale_weight_captures_status_check CHECK (status IN ('PENDING','READY','CONSUMED','EXPIRED','REJECTED')),
  CONSTRAINT terminal_scale_weight_captures_nonce_check CHECK (nonce_verifier_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT terminal_scale_weight_captures_measurement_check CHECK (status NOT IN ('READY','CONSUMED') OR (weight_kg IS NOT NULL AND weight_kg >= 0 AND measurement_source='REAL' AND measurement_unit='kg' AND unit_verified IS TRUE AND observed_at IS NOT NULL)),
  CONSTRAINT terminal_scale_weight_captures_consumption_check CHECK ((status='CONSUMED' AND consumed_at IS NOT NULL AND consumed_sale_id IS NOT NULL AND consumed_by_user_id IS NOT NULL) OR (status<>'CONSUMED' AND consumed_at IS NULL AND consumed_sale_id IS NULL AND consumed_by_user_id IS NULL)),
  CONSTRAINT terminal_scale_weight_captures_pending_empty_check CHECK (status <> 'PENDING' OR (weight_kg IS NULL AND measurement_source IS NULL AND measurement_unit IS NULL AND unit_verified IS NULL AND observed_at IS NULL)),
  CONSTRAINT terminal_scale_weight_captures_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT terminal_scale_weight_captures_branch_fk FOREIGN KEY (tenant_id,branch_id) REFERENCES public.tenant_branches(tenant_id,id) ON DELETE RESTRICT,
  CONSTRAINT terminal_scale_weight_captures_pos_fk FOREIGN KEY (pos_terminal_id,tenant_id,branch_id) REFERENCES public.pos_terminals(id,tenant_id,branch_id) ON DELETE RESTRICT,
  CONSTRAINT terminal_scale_weight_captures_operational_terminal_fk FOREIGN KEY (operational_terminal_id,tenant_id,branch_id) REFERENCES public.terminals(id,tenant_id,branch_id) ON DELETE RESTRICT,
  CONSTRAINT terminal_scale_weight_captures_session_fk FOREIGN KEY (pos_session_id,tenant_id,branch_id,operational_terminal_id) REFERENCES public.pos_user_sessions(id,tenant_id,branch_id,terminal_id) ON DELETE RESTRICT,
  CONSTRAINT terminal_scale_weight_captures_product_fk FOREIGN KEY (tenant_id,product_id) REFERENCES public.products(tenant_id,id) ON DELETE RESTRICT,
  CONSTRAINT terminal_scale_weight_captures_device_fk FOREIGN KEY (terminal_device_id,tenant_id) REFERENCES public.terminal_devices(id,tenant_id) ON DELETE RESTRICT,
  CONSTRAINT terminal_scale_weight_captures_context_fk FOREIGN KEY (terminal_scale_binding_id,tenant_id,branch_id,pos_terminal_id,operational_terminal_id,terminal_device_id,logical_scale_id) REFERENCES public.terminal_scale_bindings(id,tenant_id,branch_id,pos_terminal_id,operational_terminal_id,terminal_device_id,logical_scale_id) ON DELETE RESTRICT,
  CONSTRAINT terminal_scale_weight_captures_sale_fk FOREIGN KEY (tenant_id,consumed_sale_id) REFERENCES public.sales(tenant_id,id) ON DELETE RESTRICT,
  CONSTRAINT terminal_scale_weight_captures_consumer_fk FOREIGN KEY (tenant_id,consumed_by_user_id) REFERENCES public.users(tenant_id,id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX terminal_scale_weight_captures_nonce_unique ON public.terminal_scale_weight_captures (nonce_verifier_sha256);
CREATE INDEX terminal_scale_weight_captures_expiry_idx ON public.terminal_scale_weight_captures (status,expires_at);
CREATE INDEX terminal_scale_weight_captures_context_idx ON public.terminal_scale_weight_captures (tenant_id,branch_id,pos_terminal_id,operational_terminal_id,pos_session_id,product_id,created_at DESC);
CREATE INDEX terminal_scale_weight_captures_binding_idx ON public.terminal_scale_weight_captures (terminal_scale_binding_id,status,expires_at);

CREATE OR REPLACE FUNCTION public.reject_terminal_scale_binding_identity_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.tenant_id,NEW.branch_id,NEW.pos_terminal_id,NEW.operational_terminal_id,NEW.terminal_device_id,NEW.logical_scale_id)
     IS DISTINCT FROM ROW(OLD.tenant_id,OLD.branch_id,OLD.pos_terminal_id,OLD.operational_terminal_id,OLD.terminal_device_id,OLD.logical_scale_id) THEN
    RAISE EXCEPTION 'SCALE_BINDING_IDENTITY_IMMUTABLE: revoke and create a new binding';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_terminal_scale_binding_identity_immutable
  BEFORE UPDATE OF tenant_id,branch_id,pos_terminal_id,operational_terminal_id,terminal_device_id,logical_scale_id
  ON public.terminal_scale_bindings FOR EACH ROW
  EXECUTE FUNCTION public.reject_terminal_scale_binding_identity_change();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_terminal_device_credentials_updated_at' AND tgrelid='public.terminal_device_credentials'::regclass AND NOT tgisinternal) THEN
    CREATE TRIGGER trg_terminal_device_credentials_updated_at BEFORE UPDATE ON public.terminal_device_credentials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_terminal_scale_bindings_updated_at' AND tgrelid='public.terminal_scale_bindings'::regclass AND NOT tgisinternal) THEN
    CREATE TRIGGER trg_terminal_scale_bindings_updated_at BEFORE UPDATE ON public.terminal_scale_bindings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
  END IF;
END $$;
