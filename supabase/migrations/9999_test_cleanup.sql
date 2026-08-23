-- Test Cleanup Function
-- Only meant for testing environments. Wipes all data for a specific test user.

CREATE OR REPLACE FUNCTION rakeezx.test_cleanup(test_owner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- We rely on ON DELETE CASCADE from the years table.
  -- By deleting years, we delete terms, sections, teachings, items, sessions, enrollments, etc.
  DELETE FROM rakeezx.years WHERE owner_id = test_owner_id;
  
  -- Delete students directly as they are not children of years
  DELETE FROM rakeezx.students WHERE owner_id = test_owner_id;
  
  -- Delete subjects directly as they are not children of years
  DELETE FROM rakeezx.subjects WHERE owner_id = test_owner_id;

  -- Delete time profiles directly
  DELETE FROM rakeezx.time_profiles WHERE owner_id = test_owner_id;

  -- Delete calendars directly
  DELETE FROM rakeezx.calendars WHERE owner_id = test_owner_id;

  -- Delete the profile itself
  DELETE FROM rakeezx.profile WHERE owner_id = test_owner_id;
END;
$$;
