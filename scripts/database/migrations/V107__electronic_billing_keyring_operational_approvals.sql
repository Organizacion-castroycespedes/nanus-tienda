CREATE TABLE IF NOT EXISTS public.electronic_billing_keyring_operational_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_environment TEXT NOT NULL,
  active_key_id TEXT NOT NULL,
  key_owner_identity TEXT NOT NULL,
  recovery_verifier_identity TEXT NOT NULL,
  approval_identity TEXT NOT NULL,
  evidence_reference TEXT NOT NULL,
  evidence_fingerprint TEXT NOT NULL,
  evidence_verification_status TEXT NOT NULL,
  recovery_verification_status TEXT NOT NULL,
  recovery_verified_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'APPROVED',
  revoked_at TIMESTAMPTZ,
  revoked_by_identity TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_electronic_billing_keyring_approval_environment
    CHECK (target_environment IN ('QA')),
  CONSTRAINT chk_electronic_billing_keyring_approval_identities
    CHECK (
      btrim(key_owner_identity) <> ''
      AND btrim(recovery_verifier_identity) <> ''
      AND btrim(approval_identity) <> ''
      AND key_owner_identity <> recovery_verifier_identity
      AND approval_identity <> key_owner_identity
      AND approval_identity <> recovery_verifier_identity
    ),
  CONSTRAINT chk_electronic_billing_keyring_approval_evidence
    CHECK (
      btrim(evidence_reference) <> ''
      AND evidence_fingerprint ~ '^[0-9A-Fa-f]{64}$'
      AND evidence_verification_status IN ('VERIFIED')
      AND recovery_verification_status IN ('VERIFIED')
    ),
  CONSTRAINT chk_electronic_billing_keyring_approval_dates
    CHECK (expires_at > approved_at AND recovery_verified_at <= approved_at),
  CONSTRAINT chk_electronic_billing_keyring_approval_status
    CHECK (
      (status = 'APPROVED' AND revoked_at IS NULL AND revoked_by_identity IS NULL)
      OR (status = 'REVOKED' AND revoked_at IS NOT NULL AND btrim(revoked_by_identity) <> '')
      OR status = 'EXPIRED'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_electronic_billing_keyring_approval_active
  ON public.electronic_billing_keyring_operational_approvals (target_environment, active_key_id)
  WHERE status = 'APPROVED' AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_electronic_billing_keyring_approval_lookup
  ON public.electronic_billing_keyring_operational_approvals
    (target_environment, active_key_id, expires_at DESC);
