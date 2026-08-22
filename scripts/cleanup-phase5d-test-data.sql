-- RAKEEZ X Phase 5D Data Cleanup Script
-- Execute this in the Supabase SQL Editor to clean up timetable test data for the test account.

DO  
DECLARE
  -- To find the target UUID, you can query:
  -- SELECT owner_id, teacher_name FROM rakeezx.profile;
  target_owner uuid := 'REPLACE_WITH_TEST_ACCOUNT_UUID'; 
BEGIN
  -- 1. Delete Sessions (attendance deletes cascade automatically)
  DELETE FROM rakeezx.sessions WHERE owner_id = target_owner;
  
  -- 2. Delete Slots
  DELETE FROM rakeezx.slots WHERE owner_id = target_owner;
  
  -- 3. Delete Time Profiles
  DELETE FROM rakeezx.time_profiles WHERE owner_id = target_owner;

  RAISE NOTICE 'Timetable cleanup complete for %', target_owner;
END ;
