// Reuse rendered/native evidence only if the final candidate's Product bytes
// are unchanged, then bind the final immutable provider check and served assets.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const candidateSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const ui=JSON.parse(await readFile('test-results/n94/5d423f2e-0d7a-4af4-8f75-7a8bfe3f6edf/product-ui-result.json','utf8'));
assert.equal(ui.checks.length,3);assert.equal(ui.formLayouts.length,4);assert.equal(ui.screenshots.length,12);
const changed=execFileSync('git',['diff','--name-only',ui.candidateSha,candidateSha,'--','src','supabase/migrations'],{encoding:'utf8'}).trim();
assert.equal(changed,'','Do not reuse changed Product or migration evidence');
const response=JSON.parse(execFileSync('gh',['api',`repos/RakeezX/RakeezX/commits/${candidateSha}/check-runs`],{encoding:'utf8'}));
const check=response.check_runs.find(check=>check.name==='Cloudflare Pages'&&check.head_sha===candidateSha&&check.conclusion==='success');
assert.ok(check,'The final candidate must have a successful provider check, not merely an HTTP response');
const url=check.output.summary.match(/https:\/\/[a-f0-9]{8}\.rakeezx\.pages\.dev/)[0];
const assets=[];
for(const asset of ui.assets){
  const response=await fetch(new URL(asset.path,url));assert.equal(response.status,200);
  const served=createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
  const expected=createHash('sha256').update(execFileSync('git',['show',`${candidateSha}:${asset.path}`])).digest('hex');
  assert.equal(served,expected);assert.equal(served,asset.sha256);
  assets.push({...asset,finalCandidateSha:candidateSha});
}
const receipt={candidateSha,url,provider:{id:check.id,headSha:check.head_sha,conclusion:check.conclusion,detailsUrl:check.details_url},
  renderedEvidenceReusedFrom:ui.candidateSha,renderedEvidenceUrl:ui.url,productAndMigrationDiff:'EMPTY',assets,
  liveAuthIdsCreated:0,liveProductFixtures:0};
await writeFile('test-results/n94/5d423f2e-0d7a-4af4-8f75-7a8bfe3f6edf/final-preview-binding.json',JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt));
