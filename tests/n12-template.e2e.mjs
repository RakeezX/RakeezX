import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
  await page.goto('http://127.0.0.1:5271/',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.boot').waitFor({state:'detached',timeout:15000});
  const teaching=await page.evaluate(async()=>{const s=await import('/src/store.js');return s.teachings()[0]?.id});
  if(!teaching)throw Error('Synthetic Demo has no teaching');
  await page.goto('http://127.0.0.1:5271/#/teaching/'+teaching+'/students');
  await page.getByRole('button',{name:'استيراد ملف الأسماء',exact:true}).first().click();
  const link=page.getByRole('link',{name:'تنزيل نموذج الأسماء (CSV)'});
  if(await link.getAttribute('download')!=='نموذج-أسماء-الطلاب.csv')throw Error('Incorrect template filename');
  const downloadEvent=page.waitForEvent('download',{timeout:15000});
  await link.click();
  const download=await downloadEvent,bytes=await readFile(await download.path());
  const csv=bytes.toString('utf8');
  if(csv!=='\uFEFFاسم الطالب\r\n')throw Error('Unexpected template content '+JSON.stringify(csv));
  await page.locator('#student-file').setInputFiles({name:'نموذج-أسماء-الطلاب.csv',mimeType:'text/csv',buffer:bytes});
  await page.locator('#file-count').waitFor({state:'visible'});
  const count=await page.locator('#file-count').innerText();
  if(!count.includes('لم نجد أسماء طلاب'))throw Error('Blank template creates students: '+count);
  if(!(await page.locator('#file-confirm').isDisabled()))throw Error('Blank template enabled Add');
  console.log(JSON.stringify({result:'PASS',templateName:download.suggestedFilename(),utf8Bom:bytes.subarray(0,3).toString('hex'),onlyHeader:true,noInsert:true,viewport:390}));
} finally { await browser.close(); }
