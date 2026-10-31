-- AI: optional exact existing-role privacy configuration proposal, NOT EXECUTED.
-- Requires separately matched original custodian authority capable of this setting.
-- No GRANT SET, global config, changed credential or privilege fallback.
BEGIN;
DO $privacy_gate$ DECLARE expected_authority jsonb := 'null'::jsonb;BEGIN
 IF expected_authority->>'approved' IS DISTINCT FROM 'true' OR expected_authority->>'productId' IS DISTINCT FROM 'N88' OR expected_authority->>'action' IS DISTINCT FROM 'privacy-n88-runtime-writer-1031' OR expected_authority->>'bundleSha256' IS DISTINCT FROM '_N88_BUNDLE_SHA256_' OR expected_authority->>'projectRef' IS DISTINCT FROM 'xlrubcwjqktzzunrvuns' OR coalesce(expected_authority->>'authorityRef','')='' OR coalesce(expected_authority->>'runId','')='' OR coalesce((expected_authority->>'expiresAt')::timestamptz,'-infinity')<=clock_timestamp() OR (expected_authority->>'expiresAt')::timestamptz>clock_timestamp()+interval '45 minutes' THEN RAISE EXCEPTION 'n88_exact_runtime_writer_authority_required';END IF;
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_database()<>'postgres' OR (pg_control_system()).system_identifier::text<>'7678071634733212629' THEN RAISE EXCEPTION 'n88_runtime_writer_target_actor';END IF;
END $privacy_gate$;
ALTER ROLE n88_backend SET log_error_verbosity='terse';
COMMIT;
-- Read back through a NEW actual n88_backend LOGIN before any enablement.
