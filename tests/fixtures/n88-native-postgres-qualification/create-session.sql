-- TEST ADAPTER ONLY. Locks are acquired by protocol.mjs before this statement.
-- Caller has already reserved budgets and verified the injected private entry/PIN
-- HMACs. No raw PIN/bookmark/token is inserted, no membership is created here.
insert into n88_private.sessions
  (id,credential_id,namespace,owner_id,class_id,student_id,enrollment_id,version,
   membership_revision,entry_verifier,token_hash,expires_at)
select $1,c.id,c.namespace,c.owner_id,m.class_id,c.student_id,m.enrollment_id,
  c.version,m.revision,c.entry_verifier,$2,clock_timestamp()+interval '8 hours'
from n88_private.credentials c
join n88_private.contexts x on (x.namespace,x.owner_id)=(c.namespace,c.owner_id)
join n88_private.memberships m on (m.owner_id,m.student_id)=(c.owner_id,c.student_id)
where c.entry_verifier=$3 and c.verifier=$4 and c.revoked_at is null
  and x.active and m.active
  and (select count(*) from n88_private.memberships current_m
    where current_m.owner_id=c.owner_id and current_m.student_id=c.student_id
      and current_m.active)=1
returning id;
