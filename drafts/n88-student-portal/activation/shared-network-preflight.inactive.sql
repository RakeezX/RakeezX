-- AI: catalog-only prerequisite for this fresh staged amendment; no personal reads.
do $$ begin
 if to_regclass('n88_private.numeric_attempts') is not null or
    not exists(select 1 from pg_constraint where conrelid='n88_private.numeric_rates'::regclass and conname='numeric_rates_payload_check2' and convalidated) or
    not exists(select 1 from pg_trigger where tgrelid='n88_private.numeric_credentials'::regclass and tgname='numeric_six_capacity') then
   raise exception 'n88_budget_preflight_mismatch';
 end if;
end $$;
-- Separately authorized hosted work must first compare complete prior-six-budget
-- expected metadata identities, privileges, migration history and secret custody.
