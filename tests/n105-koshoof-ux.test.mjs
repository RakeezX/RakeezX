import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const study=await readFile('docs/automation-evidence/20261015/N105_CENTRAL_KOSHOOF_STUDY.md','utf8');
assert.match(study,/دراسة قراءة وتصميم فقط/);assert.match(study,/لم تُنفّذ/);assert.match(study,/N23\/N24\/N102/);
const paths=execFileSync('git',['diff','--name-only','c9c02a234bc3556a4ccea424ff4467e92f5437b5'],{encoding:'utf8'}).trim().split(/\r?\n/);
assert.ok(paths.every(p=>!(/report|print|pdf|supabase|src\/views\/teachings/.test(p))));
console.log('PASS study-only central proposal; no class-list, report, print, PDF, service or schema diff. UI evidence is separate actual browser evidence.');
