-- Internal score-domain trigger guards are not public RPC entry points.
revoke execute on function rakeezx.guard_subitem_definition_write()
  from public, anon, authenticated;

revoke execute on function rakeezx.guard_subitem_score_write()
  from public, anon, authenticated;
