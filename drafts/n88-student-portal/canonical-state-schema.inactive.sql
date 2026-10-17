-- AI: additional INACTIVE proposal for a FRESH private projection only.
-- Original qualified SQL is retained. Existing private rows need a separately
-- approved backfill/revocation plan, never an invented default lineage stamp.
alter table n88_private.memberships add column canonical_stamp text not null check(canonical_stamp ~ '^[a-f0-9]{64}$');
alter table n88_private.sessions add column canonical_stamp text not null check(canonical_stamp ~ '^[a-f0-9]{64}$');
