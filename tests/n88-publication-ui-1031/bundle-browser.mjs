/** AI: current private V1 entry startup and teacher-only picker import boundary. */
import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
import {start} from './host.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const root='C:/Users/Abody/Projects/RakeezX',taskId='continuous-n88-publication-ui-integration-20261031',runId='2545599f-e57e-4ae1-aed1-edef492f27b2',taskFile=`${root}/artifacts/ops-supervisor-v4/queue/${taskId}.json`;
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
let s,owned=false;const result={taskId,runId,status:'FAIL',pageErrors:[],requests:[]};
try{lease('acquire');owned=true;s=await start({bundled:true});assert(!s.bundle.text.includes('globalThis.flatpickr'));result.esbuildVersion=s.bundle.esbuildVersion;
 await withIsolatedLocalBrowser({taskFile,runId,url:s.url},async({createContext})=>{
  const c=await createContext({viewport:{width:390,height:844}}),p=await c.newPage();p.on('pageerror',e=>result.pageErrors.push(e.message));p.on('request',r=>result.requests.push(new URL(r.url()).pathname));
  await p.goto(s.url+'fixture/bundled-student');await p.locator('[data-claim] input:not(:disabled)').waitFor();
  assert.match(await p.locator('#n88-code-help').textContent(),/6/);assert.equal(s.f.state.studentCalls,0);
  assert(!result.requests.some(path=>path.endsWith('/student-portal.css')||path.includes('flatpickr')||path.includes('/publication-v2/')));
  result.privateV1Entry='PASS: actual current private document + established esbuild asset recipe, original numeric entry, V2 default OFF, no picker initialization or extra stylesheet';
  await p.goto(s.url+'#/teaching/teaching');await p.waitForFunction(()=>!!window.uiFixture);await p.getByRole('link',{name:/مساحة الطلاب/}).first().click();await p.locator('[data-publication-source]').waitFor();
  await p.locator('.n88-manual-editor>summary').click();await p.waitForFunction(()=>!!document.querySelector('[data-publication-manual] [name=startDate]')?._flatpickr);
  await p.locator('[data-publication-manual] [name=startDate]').fill('٢٠٢٦-١٠-٣١');assert.equal(await p.locator('[data-publication-manual] [name=startDate]').inputValue(),'2026-10-31');
  result.teacherPicker='PASS: actual mounted teacher imports approved picker only when needed; 0-9 normalization preserved';assert.deepEqual(result.pageErrors,[]);
 });result.status='PASS';
}catch(error){result.error=error.message;process.exitCode=1;}
finally{if(s)await s.close();if(owned)result.leaseRelease=lease('release');result.ownedBrowserAndServerClosed=true;await writeFile('tests/n88-publication-ui-1031/bundle-evidence.json',JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result,null,2));
