/** AI: materially different bounded boot diagnostic; never issues a student credential. */
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {startIntegratedReview} from '../drafts/n88-student-portal/integrated-review.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const taskId='continuous-n88-integrated-class-student-journey-20261018',runId='01c87cee-6ed3-4bf6-a51c-503fa03b1248';
const base='C:/Users/Abody/Projects/RakeezX',taskFile=base+'/artifacts/ops-supervisor-v4/queue/'+taskId+'.json';
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',base+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-RuntimeRoot',base+'/artifacts/ops-supervisor-v4','-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
const report={taskId,runId,errors:[],failedResources:[]};let review,owned=false;
try {
  report.lease=lease('acquire');owned=true;review=await startIntegratedReview({ttl:60});
  await withIsolatedLocalBrowser({taskFile,runId,url:review.url,timeoutMs:30000},async({createContext})=>{
    const c=await createContext({viewport:{width:390,height:900}}),p=await c.newPage();
    p.on('pageerror',e=>report.errors.push(e.message));
    p.on('requestfailed',r=>report.failedResources.push({path:new URL(r.url()).pathname,error:r.failure()?.errorText}));
    p.on('response',r=>{if(r.status()>=400)report.failedResources.push({path:new URL(r.url()).pathname,status:r.status()});});
    await p.goto(review.url);await p.waitForFunction(()=>window.n88Fixture||document.querySelector('.empty--error'),{},{timeout:8000}).catch(()=>{});
    if(await p.getByRole('link',{name:/مساحة الطلاب/}).count()){await p.getByRole('link',{name:/مساحة الطلاب/}).first().click();await p.locator('[data-class-portal]').waitFor();await p.waitForFunction(()=>document.querySelector('[data-class-portal]')?.textContent.length>0,{},{timeout:5000}).catch(()=>{});}
    report.binding=await p.evaluate(async()=>{const r=await import('/src/lib/student-portal-runtime.js'),store=await import('/src/store.js'),cloud=await import('/src/lib/cloud.js');try{const b=r.classBinding({store,cloud,teachingId:'teaching'});return {ready:r.PORTAL_READINESS,valid:!!b,lease:store.getOfflineLeaseStatus()};}catch(e){return {ready:r.PORTAL_READINESS,error:e.message,lease:store.getOfflineLeaseStatus()};}});
    report.dom=await p.locator('body').innerText();
    report.state=await p.evaluate(()=>({fixture:!!window.n88Fixture,layout:!!document.querySelector('.layout'),links:[...document.querySelectorAll('a')].map(a=>({text:a.textContent.trim(),href:a.getAttribute('href')}))}));
  });
}finally{await review?.close();if(owned)report.release=lease('release');await writeFile('tests/n88-integrated-class-context-diagnostic.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
