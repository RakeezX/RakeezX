-- AI N143: additive selected-only fill; the legacy full-roster RPC is untouched.
begin;
create function rakeezx.apply_sync_v2_selected_attendance_command(
  p_mutation_id text, p_device_id text, p_session_id text,
  p_student_ids text[], p_status text, p_client_updated_at bigint default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_owner uuid := auth.uid();
  v_receipt rakeezx.sync_mutation_receipts%rowtype;
  v_session rakeezx.sessions%rowtype;
  v_teaching rakeezx.teachings%rowtype;
  v_snapshot rakeezx.session_roster_snapshots%rowtype;
  v_attendance rakeezx.attendance%rowtype;
  v_members jsonb;
  v_student text;
  v_envelope jsonb;
  v_result jsonb;
  v_rows jsonb := '[]';
  v_skipped jsonb := '[]';
begin
  if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if coalesce(btrim(p_mutation_id),'')='' or coalesce(btrim(p_device_id),'')='' or
    coalesce(btrim(p_session_id),'')='' or p_status is null or p_status not in ('present','late','excused','absent') or
    p_student_ids is null or array_ndims(p_student_ids) is distinct from 1 or
    cardinality(p_student_ids) not between 1 and 300 or
    exists(select 1 from unnest(p_student_ids) id where id is null or btrim(id)='' or length(id)>300) or
    (select count(distinct id) from unnest(p_student_ids) id) <> cardinality(p_student_ids)
  then raise exception using errcode='22023',message='Invalid selected attendance command'; end if;

  -- Same outer lifecycle mutex and inner mutation/session locks as current RPCs.
  perform rakeezx.lock_student_lifecycle(v_owner);
  v_envelope := jsonb_build_object('mode','selected','mutationId',p_mutation_id,'deviceId',p_device_id,
    'sessionId',p_session_id,'studentIds',to_jsonb(p_student_ids),'status',p_status,'clientUpdatedAt',p_client_updated_at);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':sync-v2:'||p_mutation_id,0));
  select * into v_receipt from rakeezx.sync_mutation_receipts where owner_id=v_owner and mutation_id=p_mutation_id;
  if found then
    if v_receipt.request_envelope is distinct from v_envelope then
      raise exception using errcode='22023',message='Mutation ID was reused with a different request';
    end if;
    return v_receipt.result;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':session-roster:'||p_session_id,0));
  select * into v_session from rakeezx.sessions where owner_id=v_owner and id=p_session_id and deleted_at is null for update;
  if not found or v_session.status in ('cancelled','cancelled_holiday') then
    raise exception using errcode='22023',message='Attendance session is unavailable';
  end if;
  select * into v_teaching from rakeezx.teachings where owner_id=v_owner and id=v_session.teaching_id and deleted_at is null for update;
  if not found then raise exception using errcode='22023',message='Attendance teaching is unavailable'; end if;
  select * into v_snapshot from rakeezx.session_roster_snapshots
    where owner_id=v_owner and session_id=p_session_id and deleted_at is null for update;
  if not found then
    if exists(select 1 from rakeezx.attendance where owner_id=v_owner and session_id=p_session_id and deleted_at is null) then
      raise exception using errcode='22023',message='Legacy session membership is unresolved';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('studentId',e.student_id,'rollNo',e.roll_no)
      order by e.roll_no nulls last,s.name,e.student_id),'[]'::jsonb) into v_members
      from rakeezx.enrollments e join rakeezx.students s on s.owner_id=e.owner_id and s.id=e.student_id and s.deleted_at is null
      where e.owner_id=v_owner and e.section_id=v_teaching.section_id and e.status='active' and e.deleted_at is null;
  else
    if v_snapshot.state <> 'complete' then raise exception using errcode='22023',message='Session roster is incomplete'; end if;
    v_members := v_snapshot.members;
  end if;
  -- Validate the ENTIRE batch before snapshot/attendance/receipt writes.
  foreach v_student in array p_student_ids loop
    perform 1 from rakeezx.students where owner_id=v_owner and id=v_student and deleted_at is null for update;
    if not found or not (v_members @> jsonb_build_array(jsonb_build_object('studentId',v_student))) then
      raise exception using errcode='22023',message='Student is outside the owned session roster';
    end if;
    perform 1 from rakeezx.enrollments where owner_id=v_owner and student_id=v_student and
      section_id=v_teaching.section_id and status='active' and deleted_at is null for update;
    if not found then raise exception using errcode='22023',message='Student enrollment is inactive'; end if;
  end loop;
  if v_snapshot.id is null then
    perform set_config('rakeezx.sync_v2_attendance_snapshot','on',true);
    insert into rakeezx.session_roster_snapshots(owner_id,id,session_id,teaching_id,section_id,captured_at,members,state,client_updated_at,device_id)
      values(v_owner,'srs:'||p_session_id,p_session_id,v_session.teaching_id,v_teaching.section_id,clock_timestamp(),v_members,'complete',p_client_updated_at,p_device_id)
      returning * into v_snapshot;
  end if;
  foreach v_student in array p_student_ids loop
    select * into v_attendance from rakeezx.attendance
      where owner_id=v_owner and session_id=p_session_id and student_id=v_student for update;
    if found then
      -- Includes tombstones: selected import is never a restore/edit operation.
      v_skipped := v_skipped||jsonb_build_array(to_jsonb(v_attendance));
    else
      insert into rakeezx.attendance(owner_id,id,student_id,session_id,teaching_id,date,status,note,client_updated_at,device_id)
        values(v_owner,'att:'||v_student||':'||p_session_id,v_student,p_session_id,v_session.teaching_id,v_session.date,p_status,'',p_client_updated_at,p_device_id)
        returning * into v_attendance;
      v_rows := v_rows||jsonb_build_array(to_jsonb(v_attendance));
    end if;
  end loop;
  if v_session.status='scheduled' and jsonb_array_length(v_rows)>0 then
    update rakeezx.sessions set status='held',client_updated_at=p_client_updated_at,device_id=p_device_id where owner_id=v_owner and id=p_session_id;
  end if;
  v_result := jsonb_build_object('mutationId',p_mutation_id,'outcome','applied','snapshot',to_jsonb(v_snapshot),'applied',v_rows,'skipped',v_skipped);
  insert into rakeezx.sync_mutation_receipts(owner_id,mutation_id,entity,record_id,device_id,base_revision,operation,client_updated_at,request_patch,request_envelope,outcome,applied_groups,conflicted_groups,result)
    values(v_owner,p_mutation_id,'attendance',p_session_id,p_device_id,0,'fill_attendance',p_client_updated_at,
      jsonb_build_object('mode','selected','studentIds',to_jsonb(p_student_ids),'status',p_status),v_envelope,'applied',array['status']::text[],array[]::text[],v_result);
  return v_result;
end; $$;
revoke all on function rakeezx.apply_sync_v2_selected_attendance_command(text,text,text,text[],text,bigint) from public,anon;
grant execute on function rakeezx.apply_sync_v2_selected_attendance_command(text,text,text,text[],text,bigint) to authenticated;
commit;
