import {redactN88,diagnosticError} from './n88-six-digit-redaction.mjs';
/** AI: exact private schema catalog qualification, owned local PG only. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {startNativePg} from './fixtures/n88-integrated-class/native-pg.mjs';
import {readCanonical} from '../drafts/n88-student-portal/integrated-service.mjs';
const taskId='continuous-n88-six-digit-unified-student-code-20261018',runId='5c861ddc-e8ec-4325-8be2-ef9c8ba7ca45';
const base='C:/Users/Abody/Projects/RakeezX',taskFile=base+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',base+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',base+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,checks:[],cleanup:{}};let pg,owned=false;
try{
  assert.match(lease('acquire'),/^(ACQUIRED|ALREADY OWNED)/);owned=true;pg=await startNativePg(process.cwd());
  const identities=(await pg.fixtureQuery(await readFile('drafts/n88-student-portal/activation/integrated-identities.inactive.sql','utf8'))).rows[0].identities;
  assert.ok(identities.private_constraints.some(c=>c.table_name==='n88_private.numeric_credentials'&&c.definition==='UNIQUE (reservation)'));
  assert.ok(identities.private_indexes.some(i=>i.indexname==='numeric_one_active_student'&&i.indexdef.includes('WHERE (revoked_at IS NULL)')));
  assert.ok(identities.private_triggers.some(t=>t.name==='numeric_tombstones'&&t.tgenabled==='O'));
  assert.ok(identities.private_triggers.some(t=>t.name==='class_receipts_immutable'&&t.tgenabled==='O'));
  const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await pg.fixtureQuery("update rakeezx.items set revision=9007199254740993 where owner_id=$1 and id='direct'",[owner]);
  const client=await pg.acquire();
  try{await client.query('begin');const canonical=await readCanonical({query:(...a)=>client.query(...a)},owner);assert.equal(canonical.items.find(i=>i.id==='direct').revision,'9007199254740993');await client.query('rollback');}finally{client.release();}
  await writeFile('drafts/n88-student-portal/activation/integrated-expected-identities.json',JSON.stringify({sourceOnly:true,migrationVersions:['20261018034356','20261018102843','20261018110713'],identities},null,2)+'\n');
  report.checks.push({name:'exact_extended_private_constraints_indexes_and_triggers',status:'PASS',evidence:'Actual native PG catalog exports all private constraints/indexes/noninternal triggers plus existing helpers/roles/grants/policies. Global reservation UNIQUE, one-active-owner/student partial index and credential/receipt immutability triggers present and enabled. No hosted metadata or personal-row claim.'});
  report.checks.push({name:'canonical_bigint_revision_precision',status:'PASS',evidence:'Restricted native PG canonical reader preserves revision 9007199254740993 as exact text; adjacent source revisions cannot collapse through JavaScript numeric rounding.'});
}finally{await pg?.close();report.cleanup.nativePgClosed=true;if(owned)report.cleanup.lease=lease('release');await writeFile('tests/n88-six-digit-sql-identities.json',JSON.stringify(redactN88(report),null,2)+'\n');}
console.log('N88 exact private schema catalog identities PASS');
