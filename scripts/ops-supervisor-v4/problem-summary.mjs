// AI-authored derived display. Queue remains authoritative; this never writes it.
import fs from 'node:fs/promises';
import path from 'node:path';
export function summarizeProblems(jobs, map, at) {
  if (map?.version !== 1 || !Array.isArray(map.problems) || map.problems.length > 50)
    throw Error('Invalid problem map');
  const ids = new Set();
  const problems = map.problems.map(p => {
    if (!p.key || ids.has(p.key) || !Array.isArray(p.taskIds)
        || !['waiting_evidence', 'ready_to_admit', 'ops_applied', 'needs_triage'].includes(p.gate))
      throw Error('Invalid problem entry');
    ids.add(p.key);
    const tasks = jobs.filter(t => p.taskIds.includes(t.id));
    const active = tasks.filter(t => ['running', 'delivery', 'pending', 'retry_wait'].includes(t.status));
    const state = active.some(t => t.status === 'running') ? 'working'
      : active.some(t => t.status === 'delivery') ? 'delivery'
      : active.some(t => t.status === 'pending') ? 'queued'
      : active.some(t => t.status === 'retry_wait') ? 'waiting_retry'
      : tasks.some(t => p.currentTaskIds?.includes(t.id) && t.noChangeReceipt?.disposition === 'VERIFIED_NO_CHANGE') ? 'checked_no_change'
      : tasks.some(t => p.currentTaskIds?.includes(t.id) && t.noChangeReceipt?.disposition === 'RECORDED_NO_CHANGE_WITH_CHECK_GAPS') ? 'no_change_check_gaps'
      : tasks.some(t => t.status === 'blocked' && p.currentTaskIds?.includes(t.id)) ? 'blocked'
      : p.gate;
    return { key: p.key, productId: p.productId, issueNumber: p.issueNumber ?? null,
      title: p.title, state, nextAction: p.nextAction, evidenceNeeded: p.evidenceNeeded ?? null,
      taskIds: p.taskIds, activeTaskIds: active.map(t => t.id),
      latestVerifiedDeliveryAt: tasks.map(t => t.productionVerifiedAt).filter(Boolean).sort().at(-1) ?? null,
      acceptance: 'NOT_INFERRED_FROM_ATTEMPT_OR_PUBLICATION' };
  });
  return { version: 1, at, available: true, authority: map.authority,
    mapUpdatedAt: map.updatedAt, problems,
    deferredPlan: map.deferredPlan ?? [],
    diagnostic: 'Problem-level display only. Existing attempt history and Product acceptance remain separate.' };
}
export async function readProblemSummary(repo, jobs, at) {
  try {
    const file = path.join(repo, 'scripts/ops-supervisor-v4/problem-map.json');
    const st = await fs.lstat(file);
    if (!st.isFile() || st.isSymbolicLink() || st.size > 100000) throw Error('Invalid map file');
    return summarizeProblems(jobs, JSON.parse(await fs.readFile(file, 'utf8')), at);
  } catch (error) {
    return { version: 1, at, available: false,
      reason: error.code === 'ENOENT' ? 'PROBLEM_MAP_NOT_INSTALLED' : 'PROBLEM_MAP_INVALID',
      queueUnaffected: true };
  }
}
