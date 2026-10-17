-- AI: inactive proposal; no hosted application.
grant usage on schema rakeezx to n44_guard;
grant select(id,owner_id,teaching_id,date,start_time,end_time,status,revision,deleted_at),update(id) on rakeezx.sessions to n44_guard;
create policy n44_guard_read on rakeezx.sessions to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
grant select(id,owner_id,item_id,start_date,due_date,revision,deleted_at),update(id) on rakeezx.score_subitems to n44_guard;
create policy n44_guard_read on rakeezx.score_subitems to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
grant select(id,owner_id,teaching_id,score_mode,revision,deleted_at),update(id) on rakeezx.items to n44_guard;
create policy n44_guard_read on rakeezx.items to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
grant select(id,owner_id,status,hijri_start,hijri_end,calendar_preset_id,revision,deleted_at),update(id) on rakeezx.years to n44_guard;
create policy n44_guard_read on rakeezx.years to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
grant select(id,owner_id,year_id,status,revision,deleted_at),update(id) on rakeezx.sections to n44_guard;
create policy n44_guard_read on rakeezx.sections to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
grant select(id,owner_id,revision,deleted_at),update(id) on rakeezx.subjects to n44_guard;
create policy n44_guard_read on rakeezx.subjects to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
grant select(id,owner_id,year_id,source,preset_id,term_date_overrides,revision,deleted_at),update(id) on rakeezx.calendars to n44_guard;
create policy n44_guard_read on rakeezx.calendars to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
grant select(id,owner_id,calendar_id,date,kind,revision,deleted_at),update(id) on rakeezx.calendar_days to n44_guard;
create policy n44_guard_read on rakeezx.calendar_days to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
grant select(id,owner_id,year_id,"index",status,start_date,end_date,revision,deleted_at),update(id) on rakeezx.terms to n44_guard;
create policy n44_guard_read on rakeezx.terms to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
grant select(id,owner_id,section_id,subject_id,term_id,revision,deleted_at),update(id) on rakeezx.teachings to n44_guard;
create policy n44_guard_read on rakeezx.teachings to n44_guard using (owner_id::text=current_setting('n44.canonical_owner',true)) with check (false);
-- AI: exact target + parent-key canonical read proposal; no full table/owner scan.
-- Immediate canonical PK/FKs and revision triggers are required readback identities.
create function n44_push_draft.read_source(p_owner uuid,p_kind text,p_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare src jsonb; tch jsonb; sec jsonb; subj jsonb; yr jsonb; trm jsonb; cals jsonb; ds jsonb; ts jsonb;
 tid text; iid text; yid text; cid text; n integer;
begin
 perform set_config('n44.canonical_owner',p_owner::text,true);
 if p_kind='lesson' then
 select jsonb_build_object('id',id,'revision',revision::text,'deleted',deleted_at is not null,'teachingId',teaching_id,'date',date::text,'startTime',start_time::text,'endTime',end_time::text,'status',status),teaching_id into src,tid from rakeezx.sessions where owner_id=p_owner and id=p_id for share;
 elsif p_kind='due' then
 select jsonb_build_object('id',id,'revision',revision::text,'deleted',deleted_at is not null,'itemId',item_id,'startDate',start_date::text,'dueDate',due_date::text),item_id into src,iid from rakeezx.score_subitems where owner_id=p_owner and id=p_id for share;
 if not found then return null; end if;
 select src || jsonb_build_object('itemRevision',revision::text,'scoreMode',score_mode,'itemDeleted',deleted_at is not null),teaching_id into src,tid from rakeezx.items where owner_id=p_owner and id=iid for share;
 else return null; end if;
 if src is null or tid is null then return null; end if;
 select jsonb_build_object('id',id,'revision',revision::text,'deleted',deleted_at is not null,'sectionId',section_id,'subjectId',subject_id,'termId',term_id) into tch from rakeezx.teachings where owner_id=p_owner and id=tid for share;
 if not found then return null; end if;
 select jsonb_build_object('id',id,'revision',revision::text,'deleted',deleted_at is not null,'yearId',year_id,'status',status) into sec from rakeezx.sections where owner_id=p_owner and id=tch->>'sectionId' for share;
 if not found then return null; end if;
 select jsonb_build_object('id',id,'revision',revision::text,'deleted',deleted_at is not null) into subj from rakeezx.subjects where owner_id=p_owner and id=tch->>'subjectId' for share;
 if not found then return null; end if;
 select year_id into yid from rakeezx.terms where owner_id=p_owner and id=tch->>'termId';
 -- This single parent key fences new term/calendar inserts by immediate FK.
 select jsonb_build_object('id',id,'revision',revision::text,'deleted',deleted_at is not null,'status',status,'hijriStart',hijri_start,'hijriEnd',hijri_end,'calendarPresetId',calendar_preset_id) into yr from rakeezx.years where owner_id=p_owner and id=yid for update;
 if not found then return null; end if;
 select coalesce(jsonb_agg(x.v order by x.id),'[]'::jsonb),count(*) into ts,n from
 (select id,jsonb_build_object('id',id,'revision',revision::text,'deleted',deleted_at is not null,'yearId',year_id,'index',"index",'status',status,'startDate',start_date::text,'endDate',end_date::text) as v from rakeezx.terms where owner_id=p_owner and year_id=yid order by id limit 7 for share) x;
 if n>6 then raise exception 'n44_source_bound'; end if;
 select coalesce(jsonb_agg(x.v order by x.id),'[]'::jsonb),count(*) into cals,n from
 (select id,jsonb_build_object('id',id,'revision',revision::text,'deleted',deleted_at is not null,'yearId',year_id,'source',source,'presetId',preset_id,'termDateOverrides',term_date_overrides) as v from rakeezx.calendars where owner_id=p_owner and year_id=yid order by id limit 4 for update) x;
 if n>3 then raise exception 'n44_source_bound'; end if;
 -- Calendar parent locks fence inserts; bounded child locks fence edits/deletes.
 select coalesce(jsonb_agg(x.v order by x.id),'[]'::jsonb),count(*) into ds,n from
 (select d.id,jsonb_build_object('id',d.id,'revision',d.revision::text,'deleted',d.deleted_at is not null,'calendarId',d.calendar_id,'date',d.date::text,'kind',d.kind) as v from rakeezx.calendar_days d join rakeezx.calendars c on c.owner_id=d.owner_id and c.id=d.calendar_id
 where d.owner_id=p_owner and c.year_id=yid order by d.id limit 801 for share of d) x;
 if n>800 then raise exception 'n44_source_bound'; end if;
 return jsonb_build_object('source',src,'teaching',tch,'section',sec,'subject',subj,'year',yr,'terms',ts,'calendars',cals,'days',ds);
end $$;
alter function n44_push_draft.read_source(uuid,text,text) owner to n44_guard;
revoke all on function n44_push_draft.read_source(uuid,text,text) from public;
grant execute on function n44_push_draft.read_source(uuid,text,text) to n44_backend;
