// AI-authored N148 bounded cleanup preflight. No successful deletion is committed:
// the currently deployed immutable guards prohibit the requested disposition.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const PROJECT = 'xlrubcwjqktzzunrvuns';
export const AUTHORITY = 'PO-20261030-EXACT-TEST-ACCOUNT-HARD-DELETE';
export const MANIFEST_HASH = 'b671dc27a08c9553df385ef15c340801df4581a4a44b378f8698b5e5bec947e9';
const TASK = 'continuous-n148-test-account-cleanup-20261030';
const RUN = '6adc0bfe-5fc8-45b3-98d2-b4c89f089442';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const schemas = ['rakeezx', 'n44_push_draft', 'n88_private'];
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const list = values => values.map(literal).join(',');
const ident = value => '"' + value.replaceAll('"', '""') + '"';

export function validateManifest(bytes, expectedHash = MANIFEST_HASH) {
  if (createHash('sha256').update(bytes).digest('hex') !== expectedHash) throw Error('Manifest digest mismatch');
  const m = JSON.parse(bytes);
  if (m.projectId !== PROJECT || m.authorityRef !== AUTHORITY || m.allCount !== 56 ||
      m.targetIds?.length !== 50 || m.keepIds?.length !== 6 ||
      m.deleteDomains?.length !== 4 || m.deleteEmails?.length !== 5 ||
      m.expectedTargetStudentRows !== 2149 || m.expectedKeptStudentRows !== 927) throw Error('Manifest scope mismatch');
  const ids = [...m.targetIds, ...m.keepIds];
  if (ids.some(id => !uuid.test(id)) || new Set(ids).size !== 56 ||
      !m.keepIds.includes(m.exceptionId) || m.targetIds.includes(m.exceptionId)) throw Error('Identity/exception guard failed');
  if (typeof m.keepEmail !== 'string' || !m.keepEmail.includes('@') ||
      m.deleteEmails.some(s => typeof s !== 'string' || !s.includes('@')) ||
      m.deleteDomains.some(s => typeof s !== 'string' || !/^[a-z0-9.-]+$/i.test(s))) throw Error('Invalid selectors');
  return m;
}

// This checks live selectors against the pinned ID partition, not just its size.
export function selectionGuardSql(m) {
  return `do $guard$ begin
    if (select count(*) from auth.users) <> 56 or
       (select count(*) from auth.users where id::text in (${list(m.targetIds)})) <> 50 or
       (select count(*) from auth.users where id::text in (${list(m.keepIds)})) <> 6 or
       not exists(select 1 from auth.users where id=${literal(m.exceptionId)}::uuid and lower(email)=lower(${literal(m.keepEmail)})) or
       exists(select 1 from auth.users where
         ((lower(split_part(email,'@',2)) in (${list(m.deleteDomains.map(s => s.toLowerCase()))}) or
           lower(email) in (${list(m.deleteEmails.map(s => s.toLowerCase()))})) and lower(email)<>lower(${literal(m.keepEmail)}))
         is distinct from (id::text in (${list(m.targetIds)}))) or
       (select count(*) from rakeezx.students where owner_id::text in (${list(m.targetIds)})) <> 2149 or
       (select count(*) from rakeezx.students where owner_id::text in (${list(m.keepIds)})) <> 927
    then raise exception 'N148 live selection/exception/student-count guard failed'; end if;
  end $guard$;`;
}

export function snapshotSql(m, columns) {
  const tables = [...new Set(columns.filter(c => schemas.includes(c.table_schema)).map(c => `${c.table_schema}.${c.table_name}`))].sort();
  return tables.map(table => {
    const [schema, name] = table.split('.');
    const owned = columns.some(c => c.table_schema === schema && c.table_name === name && c.column_name === 'owner_id');
    const target = owned ? `r.owner_id::text in (${list(m.targetIds)})` : 'false';
    // Fingerprints remain private. Hash every protected row, including tables
    // without owner_id; never export payloads, verifiers, emails or tokens.
    return `select ${literal(table)} as tbl, count(*) as total,
      count(*) filter(where ${target}) as targets,
      count(*) filter(where not (${target})) as protected_count,
      md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' order by md5(to_jsonb(r)::text)) filter(where not (${target})),'')) as protected_fingerprint
      from ${ident(schema)}.${ident(name)} r`;
  }).concat([`select 'auth.users',count(*),count(*) filter(where id::text in (${list(m.targetIds)})),
    count(*) filter(where id::text in (${list(m.keepIds)})),
    md5(coalesce(string_agg(md5(to_jsonb(u)::text),'' order by md5(to_jsonb(u)::text)) filter(where id::text in (${list(m.keepIds)})),'')) from auth.users u`]).join('\nunion all\n');
}

export function rollbackProbeSql(m) {
  // Never COMMIT this diagnostic, including if the deployed guard changes.
  // The FK-safe probe touches only numeric_credentials; nothing precedes it.
  return `begin isolation level serializable;
    set local lock_timeout='5s'; set local statement_timeout='30s';
    ${selectionGuardSql(m)}
    delete from n88_private.numeric_credentials where owner_id::text in (${list(m.targetIds)});
    rollback;`;
}

function runCli(cli, sql, dir, label) {
  const file = path.join(dir, `${label}.sql`);
  fs.writeFileSync(file, sql, { flag: 'wx' });
  const r = spawnSync(process.execPath, [cli, 'db', 'query', '--linked', '--project-ref', PROJECT, '--file', file, '--output', 'json'], { encoding: 'utf8', maxBuffer: 20e6, timeout: 90000 });
  fs.writeFileSync(path.join(dir, `${label}.json`), r.stdout || '', { flag: 'wx' });
  fs.writeFileSync(path.join(dir, `${label}.stderr`), r.stderr || '', { flag: 'wx' });
  return r;
}

export function compareProtected(before, after) {
  return before.length === after.length && before.every(b => after.some(a => a.tbl === b.tbl &&
    a.total === b.total && a.targets === b.targets && a.protected_count === b.protected_count && a.protected_fingerprint === b.protected_fingerprint));
}

async function main() {
  const [mode, manifestPath, cli, taskFile, leaseScript] = process.argv.slice(2);
  if (!['--inspect', '--probe-rollback'].includes(mode) || !manifestPath || !cli || !taskFile || !leaseScript) {
    throw Error('Usage: --inspect|--probe-rollback PRIVATE_MANIFEST OFFICIAL_CLI CANONICAL_CARD LEASE_SCRIPT');
  }
  const m = validateManifest(fs.readFileSync(manifestPath));
  for (const privatePath of [manifestPath, path.join(path.dirname(manifestPath), '.n148-private-evidence')]) {
    const ignored = spawnSync('git', ['-C', path.dirname(manifestPath), 'check-ignore', '--quiet', '--', path.resolve(privatePath)]);
    if (ignored.status !== 0) throw Error('Private manifest/evidence directory must be ignored by Git');
  }
  const card = JSON.parse(fs.readFileSync(taskFile));
  if (card.id !== TASK || card.attempt?.runId !== RUN || card.status !== 'running' ||
      card.liveAuthorizationRef !== AUTHORITY || card.preparationAuthority?.projectId !== PROJECT ||
      card.preparationAuthority?.privateManifestSha256 !== MANIFEST_HASH ||
      path.resolve(card.preparationAuthority.privateManifest) !== path.resolve(manifestPath)) throw Error('Active card mismatch');
  const privateDir = fs.mkdtempSync(path.join(path.dirname(manifestPath), 'guard-check-'));
  // Never forward CLI stderr: it can include private SQL details.
  function query(sql, label) {
    const r = runCli(cli, sql, privateDir, label);
    if (r.status !== 0 || r.error) throw Error(`Service operation failed; private evidence: ${label}`);
    return JSON.parse(r.stdout).rows;
  }
  const columns = query(`select table_schema,table_name,column_name from information_schema.columns
    where table_schema in ('rakeezx','n44_push_draft','n88_private') order by 1,2,ordinal_position`, 'columns');
  query(`begin read only; ${selectionGuardSql(m)} select true as selection_guard; commit;`, 'selection');
  const before = query(snapshotSql(m, columns), 'before');
  const blockers = before.filter(t => ['n88_private.numeric_credentials','n88_private.class_credential_receipts','rakeezx.closed_term_reports'].includes(t.tbl) && Number(t.targets) > 0).map(t => ({ table: t.tbl, targetRows: Number(t.targets) }));
  let probe = 'NOT_RUN';
  if (mode === '--probe-rollback') {
    const lease = action => {
      const r = spawnSync('powershell.exe', ['-NoProfile','-File',leaseScript,'-Name','live-mutation','-Action',action,'-TaskFile',taskFile,'-OwnerToken',RUN,'-WaitSeconds','0'], { encoding:'utf8', timeout:30000 });
      if (r.status !== 0 || r.error) throw Error(`Live lease ${action} failed`);
    };
    let acquired = false;
    try {
      lease('acquire'); acquired = true;
      const held = JSON.parse(fs.readFileSync(path.join(path.dirname(path.dirname(taskFile)), 'leases/live-mutation.json')));
      if (held.taskId !== TASK || held.owner?.token !== RUN || held.resource !== 'live-mutation') throw Error('Live lease readback mismatch');
      const result = runCli(cli, rollbackProbeSql(m), privateDir, 'rollback-probe');
      if (result.error) throw Error('Probe transport uncertainty: inspect private result before any further operation');
      if (result.status !== 0 && /n88_numeric_unavailable/.test(result.stderr)) probe = 'REJECTED_BY_NUMERIC_IMMUTABILITY_GUARD';
      else if (result.status === 0) probe = 'ROLLED_BACK_WITHOUT_COMMIT';
      else throw Error('Unexpected probe rejection; inspect private result');
    } finally {
      if (acquired) lease('release');
    }
  }
  const after = query(snapshotSql(m, columns), 'after');
  query(`begin read only; ${selectionGuardSql(m)} select true as selection_guard; commit;`, 'readback');
  const unchanged = compareProtected(before, after);
  const summary = { state:'BLOCKED', project:PROJECT, selectionGuard:true, targetAccounts:50, keptAccounts:6,
    targetStudentRows:2149, keptStudentRows:927, blockers, probe, committed:false,
    protectedTableCount:before.length, allSnapshotCountsAndProtectedFingerprintsUnchanged:unchanged };
  fs.writeFileSync(path.join(privateDir, 'summary.json'), JSON.stringify(summary,null,2), {flag:'wx'});
  console.log(JSON.stringify(summary));
  if (!unchanged) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => { console.error('N148 stopped; inspect task-owned private evidence. No cleanup success claimed.'); process.exitCode = 1; });
}
