ALTER TABLE tenant_electronic_billing_configs
  ADD COLUMN IF NOT EXISTS encrypted_credentials TEXT;

COMMENT ON COLUMN tenant_electronic_billing_configs.encrypted_credentials IS
  'Application-encrypted provider credentials. Never store plaintext secrets.';
