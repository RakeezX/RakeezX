-- AI: exact source proposal. Disable N88_PUBLICATION_V2_ENABLED at server first.
-- The retirement writer must stay attached: do not restore the unsafe old writer.
BEGIN;
SET LOCAL lock_timeout='3s';SET LOCAL statement_timeout='15s';
DO $disable_gate$ DECLARE expected_authority jsonb := 'null'::jsonb;BEGIN
 IF expected_authority->>'approved' IS DISTINCT FROM 'true' OR expected_authority->>'productId' IS DISTINCT FROM 'N88' OR expected_authority->>'action' IS DISTINCT FROM 'disable-n88-runtime-writer-1031' OR expected_authority->>'bundleSha256' IS DISTINCT FROM '_N88_BUNDLE_SHA256_' OR expected_authority->>'projectRef' IS DISTINCT FROM 'xlrubcwjqktzzunrvuns' OR coalesce(expected_authority->>'authorityRef','')='' OR coalesce(expected_authority->>'runId','')='' OR coalesce((expected_authority->>'expiresAt')::timestamptz,'-infinity')<=clock_timestamp() OR (expected_authority->>'expiresAt')::timestamptz>clock_timestamp()+interval '45 minutes' THEN RAISE EXCEPTION 'n88_exact_runtime_writer_authority_required';END IF;
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_database()<>'postgres' OR (pg_control_system()).system_identifier::text<>'7678071634733212629' THEN RAISE EXCEPTION 'n88_runtime_writer_target_actor';END IF;
END $disable_gate$;
-- BEGIN EXACT DISABLE DELTA
REVOKE EXECUTE ON FUNCTION n88_private.v2_runtime_identity_1031() FROM n88_backend;
DO $owner_gate$ BEGIN IF current_user<>'postgres' OR session_user<>'postgres' OR NOT pg_has_role(current_user,'n88_v2_guard','MEMBER WITH ADMIN OPTION') OR EXISTS(select 1 from pg_auth_members where roleid='n88_v2_guard'::regrole and member='postgres'::regrole and grantor='postgres'::regrole) THEN RAISE EXCEPTION 'n88_runtime_exact_owner_admin_required';END IF;END $owner_gate$;
GRANT n88_v2_guard TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY postgres;
SET LOCAL ROLE n88_v2_guard;
REVOKE EXECUTE ON FUNCTION n88_private.v2_f8a1689cd78951d7fc52ef91(uuid) FROM n88_backend;
REVOKE EXECUTE ON FUNCTION n88_private.v2_7874a827dae2373223bc8adc(text) FROM n88_backend;
REVOKE EXECUTE ON FUNCTION n88_private.v2_6d27c8049efec0665b9d1f91(uuid,uuid,text,text) FROM n88_backend;
REVOKE EXECUTE ON FUNCTION n88_private.v2_e1b1c0927f6164faeccb760b(uuid,integer,integer,integer) FROM n88_backend;
REVOKE EXECUTE ON FUNCTION n88_private.v2_f46afed1e023d013cdabf257(uuid,integer,integer,integer) FROM n88_backend;
REVOKE EXECUTE ON FUNCTION n88_private.v2_0dad27a56bfdc5bfab552235(uuid,integer,integer,integer) FROM n88_backend;
REVOKE EXECUTE ON FUNCTION n88_private.v2_71a3e914da47cf1053850671(uuid,integer,integer,integer) FROM n88_backend;
REVOKE EXECUTE ON FUNCTION n88_private.v2_74c4aa4d430911e99002af80(uuid,text,text) FROM n88_backend;
REVOKE EXECUTE ON FUNCTION n88_private.v2_dbe074dae923ca8a3746d390(uuid,text,text,text) FROM n88_backend;
REVOKE EXECUTE ON FUNCTION n88_private.v2_a3e6d95cdff2d66f56ae84f6(uuid,text,text,text,boolean,text) FROM n88_backend;
REVOKE EXECUTE ON FUNCTION n88_private.v2_5d62e77b02ab6a1fb4e97688(uuid,text,text,text,boolean,text,text,text) FROM n88_backend;
REVOKE EXECUTE ON FUNCTION n88_private.v2_23ccfc1e16cd0b122d0cb3c3(uuid,text,text,text,boolean) FROM n88_backend;
REVOKE EXECUTE ON FUNCTION n88_private.v2_94bb23dac56c2e002713130a(uuid,text,text,text,boolean,text,boolean) FROM n88_backend;
REVOKE EXECUTE ON FUNCTION n88_private.v2_3b143936c792a16ff5425c3d(uuid,text,text,text,text) FROM n88_backend;
SET LOCAL ROLE postgres;
REVOKE n88_v2_guard FROM postgres GRANTED BY postgres;
DO $restored$ BEGIN IF current_user<>'postgres' OR session_user<>'postgres' OR pg_has_role('postgres','n88_v2_guard','SET') OR pg_has_role('postgres','n88_v2_guard','USAGE') OR pg_has_role('n88_backend','n88_v2_guard','SET') THEN RAISE EXCEPTION 'n88_runtime_owner_role_not_restored';END IF;END $restored$;
-- END EXACT DISABLE DELTA
COMMIT;
-- No DROP, receipt purge, tombstone reset, ownership transfer or automatic replay.
