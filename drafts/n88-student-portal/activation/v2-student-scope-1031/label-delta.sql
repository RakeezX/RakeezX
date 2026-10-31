-- AI: exact additional private read capability. No storage operation replacement.
DO $label_gate$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR
 to_regprocedure('n88_private.safe_student_scope_labels_1031(text)') IS NOT NULL OR
 NOT has_table_privilege(current_user,'rakeezx.subjects','SELECT') OR NOT has_table_privilege(current_user,'n88_private.numeric_sessions','SELECT')
 THEN RAISE EXCEPTION 'n88_label_preimage_required';END IF;
END $label_gate$;
-- Existing legitimate table owner creates one FIXED private reader. No raw read
-- grant, old-guard membership/ACL change or new elevated role is introduced.
CREATE FUNCTION n88_private.safe_student_scope_labels_1031(p text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $labels$
DECLARE a jsonb;o uuid;c text;s uuid;d date;v jsonb;member jsonb;
BEGIN
 IF p IS NULL OR length(p)>4096 OR p !~ '^[A-Za-z0-9+/]*={0,2}$' THEN RAISE EXCEPTION 'n88_fixed_failure';END IF;
 a:=convert_from(decode(p,'base64'),'UTF8')::jsonb;
 IF jsonb_typeof(a)<>'array' OR jsonb_array_length(a)<>4 OR EXISTS(select 1 from jsonb_array_elements(a) x where jsonb_typeof(x)<>'string') THEN RAISE EXCEPTION 'n88_fixed_failure';END IF;
 o:=(a->>0)::uuid;c:=a->>1;s:=(a->>2)::uuid;d:=(a->>3)::date;
 IF session_user<>'n88_backend' OR o::text IS DISTINCT FROM current_setting('n88.v2_owner',true) OR length(c) NOT BETWEEN 1 AND 200 OR (a->>3) !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'n88_fixed_failure';END IF;
 SELECT ns.payload INTO member FROM n88_private.numeric_sessions ns WHERE ns.row_key=s::text AND ns.owner_id=o AND ns.payload->>'revokedAt' IS NULL AND (ns.payload->>'expiresAt')::bigint>extract(epoch from clock_timestamp())*1000;
 IF member IS NULL OR member->>'classId'<>c OR NOT EXISTS(select 1 from rakeezx.enrollments e JOIN rakeezx.students st ON st.owner_id=e.owner_id AND st.id=e.student_id
 WHERE e.owner_id=o AND e.id=member->>'enrollmentId' AND e.student_id=member->>'studentId' AND e.section_id=c AND e.status='active' AND e.end_date IS NULL AND e.deleted_at IS NULL AND st.deleted_at IS NULL AND st.status='active') THEN RAISE EXCEPTION 'n88_fixed_failure';END IF;
 SELECT jsonb_build_object('command','SELECT','rowCount',count(*)::integer,'rows',coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb)) INTO v FROM (
  SELECT t.id AS teaching_id,t.subject_id,t.term_id,su.name AS subject_name,tr.name AS term_name
  FROM rakeezx.teachings t JOIN rakeezx.subjects su ON su.owner_id=t.owner_id AND su.id=t.subject_id AND su.deleted_at IS NULL
  JOIN rakeezx.sections se ON se.owner_id=t.owner_id AND se.id=t.section_id AND se.deleted_at IS NULL AND se.archived_at IS NULL AND se.status='active'
  JOIN rakeezx.years y ON y.owner_id=se.owner_id AND y.id=se.year_id AND y.deleted_at IS NULL AND y.status='active'
  JOIN rakeezx.terms tr ON tr.owner_id=t.owner_id AND tr.id=t.term_id AND tr.year_id=se.year_id AND tr.deleted_at IS NULL AND tr.status='active'
  WHERE t.owner_id=o AND t.section_id=c AND t.deleted_at IS NULL AND (tr.start_date IS NULL OR tr.start_date<=d) AND (tr.end_date IS NULL OR tr.end_date>=d)
  ORDER BY t.id LIMIT 2001 FOR SHARE OF su
 ) r;
 IF (v->>'rowCount')::integer>2000 OR octet_length(v::text)>2097152 OR EXISTS(select 1 from jsonb_array_elements(v->'rows') r WHERE length(btrim(r->>'subject_name')) NOT BETWEEN 1 AND 2000 OR length(btrim(r->>'term_name')) NOT BETWEEN 1 AND 2000) THEN RAISE EXCEPTION 'n88_fixed_failure';END IF;
 RETURN jsonb_build_object('ok',true,'result',v);
EXCEPTION WHEN query_canceled THEN RETURN '{"ok":false,"failure":"cancelled"}'::jsonb;
 WHEN assert_failure THEN RETURN '{"ok":false,"failure":"assertion"}'::jsonb;
 WHEN others THEN RETURN '{"ok":false,"failure":"unavailable"}'::jsonb;
END $labels$;
REVOKE ALL ON FUNCTION n88_private.safe_student_scope_labels_1031(text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION n88_private.safe_student_scope_labels_1031(text) TO n88_backend;
DO $label_restored$ BEGIN IF pg_has_role('postgres','n88_v2_guard','SET') OR pg_has_role('postgres','n88_v2_guard','USAGE') OR has_schema_privilege('n88_v2_guard','n88_private','CREATE') THEN RAISE EXCEPTION 'n88_label_owner_not_restored';END IF;END $label_restored$;
