-- TEST ADAPTER ONLY. Called inside the context/membership/credential/session lock
-- transaction. Synthetic memberships are NOT a canonical enrollment adapter.
select s.owner_id,s.class_id,s.student_id,s.enrollment_id
from n88_private.sessions s
join n88_private.credentials c on
  (c.id,c.namespace,c.owner_id,c.student_id,c.version,c.entry_verifier) =
  (s.credential_id,s.namespace,s.owner_id,s.student_id,s.version,s.entry_verifier)
join n88_private.contexts x on (x.namespace,x.owner_id)=(c.namespace,c.owner_id)
join n88_private.memberships m on
  (m.owner_id,m.class_id,m.student_id,m.enrollment_id,m.revision) =
  (s.owner_id,s.class_id,s.student_id,s.enrollment_id,s.membership_revision)
where s.token_hash=$1 and s.entry_verifier=$2
  and s.revoked_at is null and s.expires_at>clock_timestamp()
  and c.revoked_at is null and x.active and m.active
  and (select count(*) from n88_private.memberships current_m
    where current_m.owner_id=c.owner_id and current_m.student_id=c.student_id
      and current_m.active)=1;
