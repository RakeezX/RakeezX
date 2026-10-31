/** AI: final CSS-only affected dark-theme inspection; reuses unchanged functional browser proof. */
import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
import {start} from './host.mjs';
import {withIsolatedLocalBrowser} from 'file:///C:/Users/Abody/Projects/RakeezX/scripts/ops-supervisor-v4/isolated-local-browser.mjs';
const root='C:/Users/Abody/Projects/RakeezX',taskId='continuous-n88-publication-ui-integration-20261031',runId='2545599f-e57e-4ae1-aed1-edef492f27b2',taskFile=`${root}/artifacts/ops-supervisor-v4/queue/${taskId}.json`;
const lease=action=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',root+'/scripts/ops-supervisor-v4/resource-lease.ps1','-Name','integration','-Action',action,'-TaskFile',taskFile,'-WaitSeconds','0','-OwnerToken',runId],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
let s,owned=false;const result={taskId,runId,status:'FAIL'};
try{lease('acquire');owned=true;s=await start();await withIsolatedLocalBrowser({taskFile,runId,url:s.url},async({createContext})=>{
 const context=await createContext({viewport:{width:390,height:844},colorScheme:'dark'}),page=await context.newPage();
 await page.goto(s.url+'#/teaching/teaching');await page.waitForFunction(()=>!!window.uiFixture);await page.getByRole('link',{name:/مساحة الطلاب/}).first().click();
 await page.locator('[data-publication-source]').waitFor();
 const colors=await page.evaluate(()=>{document.documentElement.dataset.theme='dark';const panel=document.querySelector('.n88-publications'),select=panel.querySelector('select');
  const expected=document.createElement('div');expected.style.background='var(--bg-elev)';document.body.append(expected);const bg=getComputedStyle(expected).backgroundColor;expected.remove();
  return {background:getComputedStyle(panel).backgroundColor,inputBackground:getComputedStyle(select).backgroundColor,text:getComputedStyle(panel).color,expected:bg,overflow:document.documentElement.scrollWidth>innerWidth};});
 assert.equal(colors.background,colors.expected);assert.equal(colors.inputBackground,colors.expected);assert.notEqual(colors.text,colors.background);assert.equal(colors.overflow,false);
 await page.screenshot({path:'tests/n88-publication-ui-1031/teacher-dark-390.png',fullPage:true});result.colors=colors;
});result.status='PASS';}catch(error){result.error=error.message;process.exitCode=1;}
finally{if(s)await s.close();if(owned)result.leaseRelease=lease('release');result.ownedBrowserAndServerClosed=true;await writeFile('tests/n88-publication-ui-1031/style-evidence.json',JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result));
