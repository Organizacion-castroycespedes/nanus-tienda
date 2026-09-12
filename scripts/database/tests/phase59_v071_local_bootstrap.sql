-- Local Phase 5.9 bootstrap only. Never run against QA or production.
-- V071 expects the approved fixture identifiers, while a fresh local seed
-- creates equivalent terminal rows with generated identifiers.
BEGIN;

DO $$
DECLARE
  local_branch uuid;
  existing_pos uuid;
  existing_terminal uuid;
BEGIN
  SELECT id INTO local_branch
  FROM public.tenant_branches
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
  ORDER BY es_principal DESC, id
  LIMIT 1;

  IF local_branch IS NULL THEN
    RAISE EXCEPTION 'Phase 5.9 local bootstrap requires the seeded tenant branch';
  END IF;

  SELECT id INTO existing_pos
  FROM public.pos_terminals
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND branch_id = local_branch
    AND code = 'local-terminal';

  IF existing_pos IS NOT NULL
     AND existing_pos <> 'e186b5bd-4873-49bb-9450-f141570cce80'::uuid THEN
    UPDATE public.pos_terminals
    SET code = 'phase59-generated-terminal'
    WHERE id = existing_pos;
  END IF;

  SELECT id INTO existing_terminal
  FROM public.terminals
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND branch_id = local_branch
    AND code = 'TERM-001';

  IF existing_terminal IS NOT NULL
     AND existing_terminal <> '693921eb-d28d-4c1b-af17-087b589c6467'::uuid THEN
    UPDATE public.terminals
    SET code = 'PHASE59-GENERATED'
    WHERE id = existing_terminal;
  END IF;

  INSERT INTO public.terminals (
    id, tenant_id, branch_id, name, code, device_fingerprint, is_active
  ) VALUES (
    '693921eb-d28d-4c1b-af17-087b589c6467'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    local_branch,
    'Phase 5.9 local terminal',
    'TERM-001',
    NULL,
    TRUE
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.pos_terminals (
    id, tenant_id, branch_id, code, name, description, active, mode
  ) VALUES (
    'e186b5bd-4873-49bb-9450-f141570cce80'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    local_branch,
    'local-terminal',
    'Phase 5.9 local POS terminal',
    'Disposable local migration test fixture',
    TRUE,
    'HYBRID'
  ) ON CONFLICT (id) DO NOTHING;
END $$;

COMMIT;
