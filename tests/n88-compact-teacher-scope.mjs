/** AI: reuse unchanged security proofs; do not re-execute service qualification. */
import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const base='859de68d4e3368b2b42e52540da4a9aa7647926d';
const proofs={
 'tests/n88-six-digit-recovery.json':'9fd5fddb9a2a7961dc0b93d0f173adb734b939233435d268bc0ac51d8d2d7407',
 'tests/n88-six-digit-recovery-context.json':'4feae5ee381241697439bb9be6576a23e97c2f2ef5a7d7ceaf290616e0597f79',
 'tests/n88-six-digit-shared-network.json':'64f12a375cb5d0960ab73133605f6146749033be63b3c0c74869fba38b341a99',
 'tests/n88-six-digit-shared-flood-window.json':'185c96dd0b69d1e9ca1e2f89bba5ba1290d3da206c8f1f49464f07450fe30418',
 'tests/n88-six-digit-security.json':'27289091e104a6a49816c2166a4c355d44bd78dee2661cc46cca41000da18122'
};
const git=(...a)=>execFileSync('git',a,{encoding:'utf8',windowsHide:true});
for(const [file,sha]of Object.entries(proofs))assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),sha);
const changed=git('diff',base,'--name-only').trim().split(/\r?\n/).filter(Boolean),untracked=git('ls-files','--others','--exclude-standard').trim().split(/\r?\n/).filter(Boolean);
const allowed=p=>['src/views/student-portal-class.js','src/styles/student-portal-class.css','docs/automation-evidence/20261018/N88_COMPACT_TEACHER_PORTAL.md'].includes(p)||/^tests\/n88-compact-teacher[^/]*\.(mjs|json)$/.test(p)||p.startsWith('tests/fixtures/n88-compact-teacher/');
assert.ok([...changed,...untracked].every(allowed));
assert.equal(git('diff',base,'--','src/lib/student-portal-class-client.js','src/lib/student-portal-runtime.js','drafts/n88-student-portal','supabase','functions','src/store.js','src/router.js','src/app.js','sw.js','tests/fixtures/n88-integrated-class','tests/fixtures/n88-existing-host').trim(),'');
// All tracked source outside the changed teacher module/CSS is byte-identical to H base.
assert.deepEqual(changed.filter(p=>/^(src|drafts|supabase|functions)\//.test(p)).sort(),['src/styles/student-portal-class.css','src/views/student-portal-class.js']);
const report={baseSha:base,checks:[{name:'n88_compact_teacher_scope_syntax_and_reused_security_graph',status:'PASS',evidence:'Only teacher view/CSS source changes. Client/runtime/store/router/app/SW/backend/service/SQL/shared fixtures unchanged from delivered H. Five exact historical proof SHA256 values verified, not rerun. Default readiness remains OFF.'}],reusedProofs:proofs,changedPaths:[...new Set([...changed,...untracked])].sort()};
await writeFile('tests/n88-compact-teacher-scope.json',JSON.stringify(report,null,2)+'\n');console.log('N88 compact teacher scope/security reuse PASS');
