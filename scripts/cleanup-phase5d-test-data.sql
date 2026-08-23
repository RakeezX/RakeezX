-- Safe Test Cleanup Script for Phase 5D
-- Test owner MUST be exactly: 9e3a9858-50bb-470e-91f6-8ea901ffb030
-- Safely deletes timetable test data ONLY for this specific test user.
-- Preserves all core structural entities (years, terms, teachings, students, items, scores, profile).

BEGIN;

-- Safe FK order deletion for the test user ONLY
DELETE FROM rakeezx.attendance WHERE owner_id = '9e3a9858-50bb-470e-91f6-8ea901ffb030';
DELETE FROM rakeezx.sessions WHERE owner_id = '9e3a9858-50bb-470e-91f6-8ea901ffb030';
DELETE FROM rakeezx.slots WHERE owner_id = '9e3a9858-50bb-470e-91f6-8ea901ffb030';
DELETE FROM rakeezx.time_profiles WHERE owner_id = '9e3a9858-50bb-470e-91f6-8ea901ffb030';

COMMIT;
