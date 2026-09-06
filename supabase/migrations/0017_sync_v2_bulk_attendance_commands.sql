-- RAKEEZ X — SYNC-V2C2-B3-B: atomic fillAttendance command.
begin;
alter table rakeezx.sync_mutation_receipts drop constraint if exists sync_mutation_receipts_operation_check;
alter table rakeezx.sync_mutation_receipts add constraint sync_mutation_receipts_operation_check check (operation in ('create','patch','delete','enroll','transfer','withdraw','attendance','lifecycle','create_teaching','fill_attendance'));
create or replace function rakeezx.apply_sync_v2_fill_attendance_command(p_mutation_id text,p_device_id text,p_session_id text,p_status text,p_client_updated_at bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_receipt rakeezx.sync_mutation_receipts%rowtype; v_session rakeezx.sessions%rowtype; v_teaching rakeezx.teachings%rowtype; v_snapshot rakeezx.session_roster_snapshots%rowtype; v_attendance rakeezx.attendance%rowtype; v_members jsonb; v_member jsonb; v_rows jsonb:='[]'::jsonb; v_skipped jsonb:='[]'::jsonb; v_row jsonb; v_envelope jsonb; v_result jsonb;
begin
 if v_owner is null then raise exception using errcode='42501',message='Authentication required'; end if;
 if coalesce(p_mutation_id,'')='' or coalesce(p_device_id,'')='' or coalesce(p_session_id,'')='' or p_status not in ('present','late','excused','absent') then raise exception using errcode='22023',message='Invalid Sync V2 fill attendance command'; end if;
 v_envelope:=jsonb_build_object('mutationId',p_mutation_id,'deviceId',p_device_id,'sessionId',p_session_id,'status',p_status,'clientUpdatedAt',p_client_updated_at);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':sync-v2:'||p_mutation_id,0)); select * into v_receipt from rakeezx.sync_mutation_receipts where owner_id=v_owner and mutation_id=p_mutation_id;
 if found then if v_receipt.request_envelope is distinct from v_envelope then raise exception using errcode='22023',message='Mutation ID was reused with a different request'; end if; return v_receipt.result; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner::text||':session-roster:'||p_session_id,0)); select * into v_session from rakeezx.sessions where owner_id=v_owner and id=p_session_id and deleted_at is null for update;
 if not found or v_session.status in ('cancelled','cancelled_holiday') then raise exception using errcode='22023',message='Attendance session is unavailable'; end if;
 select * into v_teaching from rakeezx.teachings where owner_id=v_owner and id=v_session.teaching_id and deleted_at is null for update; if not found then raise exception using errcode='22023',message='Attendance teaching is unavailable'; end if;
 select * into v_snapshot from rakeezx.session_roster_snapshots where owner_id=v_owner and session_id=p_session_id and deleted_at is null for update;
 if not found then
   if exists(select 1 from rakeezx.attendance where owner_id=v_owner and session_id=p_session_id and deleted_at is null) then raise exception using errcode='22023',message='Legacy session membership is unresolved'; end if;
   select coalesce(jsonb_agg(jsonb_build_object('studentId',e.student_id,'rollNo',e.roll_no) order by e.roll_no nulls last,s.name,e.student_id),'[]'::jsonb) into v_members from rakeezx.enrollments e join rakeezx.students s on s.owner_id=e.owner_id and s.id=e.student_id and s.deleted_at is null where e.owner_id=v_owner and e.section_id=v_teaching.section_id and e.status='active' and e.deleted_at is null;
   perform set_config('rakeezx.sync_v2_attendance_snapshot','on',true); insert into rakeezx.session_roster_snapshots(owner_id,id,session_id,teaching_id,section_id,captured_at,members,state,client_updated_at,device_id) values(v_owner,'srs:'||p_session_id,p_session_id,v_session.teaching_id,v_teaching.section_id,clock_timestamp(),v_members,'complete',p_client_updated_at,p_device_id) returning * into v_snapshot;
 end if;
 for v_member in select value from jsonb_array_elements(v_snapshot.members) loop
   if exists(select 1 from rakeezx.attendance where owner_id=v_owner and session_id=p_session_id and student_id=v_member->>'studentId' and deleted_at is null) then select to_jsonb(a) into v_row from rakeezx.attendance a where a.owner_id=v_owner and a.session_id=p_session_id and a.student_id=v_member->>'studentId' and a.deleted_at is null; v_skipped:=v_skipped||jsonb_build_array(v_row||jsonb_build_object('bulkDisposition','skipped'));
   else insert into rakeezx.attendance(owner_id,id,student_id,session_id,teaching_id,date,status,note,client_updated_at,device_id) values(v_owner,'att:'||(v_member->>'studentId')||':'||p_session_id,v_member->>'studentId',p_session_id,v_session.teaching_id,v_session.date,p_status,'',p_client_updated_at,p_device_id) returning * into v_attendance; v_rows:=v_rows||jsonb_build_array(to_jsonb(v_attendance)); end if;
 end loop;
 if v_session.status='scheduled' then update rakeezx.sessions set status='held',client_updated_at=p_client_updated_at,device_id=p_device_id where owner_id=v_owner and id=p_session_id; end if;
 v_result:=jsonb_build_object('mutationId',p_mutation_id,'outcome','applied','snapshot',to_jsonb(v_snapshot),'applied',v_rows,'skipped',v_skipped);
 insert into rakeezx.sync_mutation_receipts(owner_id,mutation_id,entity,record_id,device_id,base_revision,operation,client_updated_at,request_patch,request_envelope,outcome,applied_groups,conflicted_groups,result) values(v_owner,p_mutation_id,'attendance',p_session_id,p_device_id,0,'fill_attendance',p_client_updated_at,jsonb_build_object('status',p_status),v_envelope,'applied',array['status']::text[],array[]::text[],v_result);
 return v_result;
end; $$;
revoke all on function rakeezx.apply_sync_v2_fill_attendance_command(text,text,text,text,bigint) from public;
grant execute on function rakeezx.apply_sync_v2_fill_attendance_command(text,text,text,text,bigint) to authenticated;
commit;
