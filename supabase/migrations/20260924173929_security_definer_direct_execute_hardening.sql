-- These are internal SECURITY DEFINER helpers, not direct Product RPCs.
-- Their defining-owner callers retain EXECUTE; client roles do not.
revoke execute on function rakeezx.section_for_operational_row(text, jsonb)
  from public, anon, authenticated;

revoke execute on function rakeezx.teaching_delete_blocker(uuid, text)
  from public, anon, authenticated;

-- Remaining Advisor findings: an internal trigger and a private Sync helper.
revoke execute on function rakeezx.guard_safe_session_delete()
  from public, anon, authenticated;

-- The authenticated invoker revision-trigger chain needs this static field map.
-- It does not read owner data; remove anonymous/default exposure only.
revoke execute on function rakeezx.sync_v2_field_map(text)
  from public, anon;
grant execute on function rakeezx.sync_v2_field_map(text) to authenticated;

revoke execute on function rakeezx.sync_v2_natural_key(text, jsonb)
  from public, anon, authenticated;
