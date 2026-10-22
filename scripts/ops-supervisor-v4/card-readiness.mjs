// AI-authored. Read-only pre-admission check; not a dispatcher or a permission grant.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
const safe = value => typeof value === 'string' && value.length > 0 && value.length < 250
  && !/[\\\x00-\x1f:*?<>|]/.test(value) && !value.startsWith('/')
  && value.split('/').every(p => p && p !== '.' && p !== '..' && !p.endsWith('.'));
const covered = (file, patterns) => patterns.some(p => p === file
  || typeof p === 'string' && p.endsWith('/**') && file.startsWith(p.slice(0, -2)));
const equalSet = (a, b) => Array.isArray(a) && Array.isArray(b)
  && a.length === b.length && new Set(a).size === a.length && a.every(v => b.includes(v));
export async function inspectCardReadiness(card, repo, options = {}) {
  const errors = [], p = card?.preflight;
  const fail = (code, detail) => errors.push({ code, detail });
  if (p?.version !== 1) return { passed: false, errors: [{ code: 'READINESS_MISSING', detail: 'New cards require a v1 preflight; existing queue sessions are not requalified.' }] };
  if (!/^[a-f0-9]{40}$/.test(p.sourceCommit ?? '')) fail('SOURCE_COMMIT', 'Pin the reviewed source commit.');
  const fields = ['requiredSourcePaths', 'editPaths', 'newPaths', 'workerChecks', 'publisherChecks'];
  for (const key of fields) {
    if (!Array.isArray(p[key]) || new Set(p[key]).size !== p[key].length
        || p[key].some(v => typeof v !== 'string' || !v)) fail('FIELD_INVALID', key);
  }
  if (errors.length) return { passed: false, errors };
  if (!p.requiredSourcePaths.length || !p.editPaths.length || !p.workerChecks.length) fail('EMPTY_PLAN', 'Source, edit scope and worker checks must be explicit.');
  for (const file of [...p.requiredSourcePaths, ...p.editPaths, ...p.newPaths]) {
    if (!safe(file)) fail('UNSAFE_PATH', 'Use exact repository-relative paths.');
  }
  for (const file of p.editPaths) if (!covered(file, card.allowedPaths ?? [])) fail('EDIT_OUTSIDE_SCOPE', file);
  for (const file of p.newPaths) if (!p.editPaths.includes(file)) fail('NEW_PATH_UNDECLARED', file);
  if (!equalSet(p.workerChecks, card.requiredChecks)) fail('WORKER_CHECKS_DIFFER', 'Worker obligations must match requiredChecks.');
  if (!equalSet(p.publisherChecks, card.postDeliveryChecks ?? [])) fail('PUBLISHER_CHECKS_DIFFER', 'Publisher obligations must match postDeliveryChecks.');
  if (p.workerChecks.some(c => p.publisherChecks.includes(c))) fail('PHASE_COLLISION', 'A publisher-only check cannot gate LOCAL_READY.');
  if (errors.length) return { passed: false, errors };
  const requested = [...new Set([...p.requiredSourcePaths, ...p.editPaths])];
  try {
    const listPaths = options.listPaths ?? (async () => {
      const { stdout } = await execute(options.gitPath ?? 'git',
        ['ls-tree', '-r', '--name-only', p.sourceCommit, '--', ...requested],
        { cwd: repo, timeout: 10000, windowsHide: true, maxBuffer: 1024 * 1024 });
      return stdout.split(/\r?\n/).filter(Boolean);
    });
    const existing = new Set(await listPaths(p.sourceCommit, requested));
    for (const file of p.requiredSourcePaths) if (!existing.has(file)) fail('SOURCE_MISSING', file);
    for (const file of p.editPaths) if (!existing.has(file) && !p.newPaths.includes(file)) fail('EDIT_PATH_MISSING', file);
    for (const file of p.newPaths) if (existing.has(file)) fail('NEW_PATH_ALREADY_EXISTS', file);
  } catch { fail('SOURCE_READ_UNAVAILABLE', 'The pinned source could not be inspected read-only. No dispatch or authority expansion.'); }
  return { passed: errors.length === 0, sourceCommit: p.sourceCommit, errors,
    limits: 'Validates declared scope and phases, not a complete dependency graph or Product acceptance.' };
}
