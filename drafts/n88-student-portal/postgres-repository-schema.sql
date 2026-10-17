-- AI: INACTIVE local pilot supplement; NOT a hosted migration or canonical resolver.
-- Apply only after schema-proposal.sql in the explicitly owned synthetic cluster.
-- Keep the original qualified schema unchanged; represent all existing service guards.
alter table n88_private.memberships
  add column status text not null check (status in ('active','inactive','ended')),
  add column end_date date,
  add column student_active boolean not null,
  add column class_active boolean not null,
  add column label text not null check (length(label) <= 300),
  add constraint n88_membership_active_projection check
    (active = (status = 'active' and end_date is null and student_active and class_active));
