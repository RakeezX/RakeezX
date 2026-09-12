-- RAKEEZ X — SUPPORT-NOTIFICATION-V1-01.1
-- Server-only access to the existing teacher display name for internal Support
-- email follow-up. Browser policies and the profile model remain unchanged.
set lock_timeout = '10s';

begin;

grant select on table rakeezx.profile to service_role;

commit;
