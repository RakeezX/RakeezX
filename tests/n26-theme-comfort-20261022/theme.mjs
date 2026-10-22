import fs from 'node:fs/promises';
import path from 'node:path';
import { withIsolatedLocalBrowser } from '../../scripts/ops-supervisor-v4/isolated-local-browser.mjs';

const taskFile = 'C:/Users/Abody/Projects/RakeezX/artifacts/ops-supervisor-v4/queue/continuous-n26-theme-comfort-representative-slice-20261022.json';
const runId = 'e88b63d2-eac1-4429-84ef-fc613c4aabec';
const origin = 'http://127.0.0.1:4178/';
const outDir = path.resolve('tests/n26-theme-comfort-20261022');
await fs.mkdir(outDir, { recursive: true });
const rows = [];
const luminance = hex => {
  const rgb=hex.match(/[0-9a-f]{2}/gi).map(value=>parseInt(value,16)/255)
    .map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);
  return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
};
const contrast = (foreground,background) => {
  const a=luminance(foreground.replace('#','')),b=luminance(background.replace('#',''));
  return Number(((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)).toFixed(2));
};

await withIsolatedLocalBrowser({ taskFile, runId, url: origin, timeoutMs: 120000 }, async ({ createContext }) => {
  for (const viewport of [{width:390,height:844},{width:1365,height:768}]) {
    const context = await createContext({ viewport, locale:'ar-SA', colorScheme:'light' });
    await context.addInitScript(() => sessionStorage.setItem('rakeezx-demo-session-v1', 'preparing'));
    const page = await context.newPage();
    const errors=[]; page.on('pageerror', e=>errors.push(String(e)));
    await page.goto(origin, { waitUntil:'domcontentloaded' });
    await page.waitForTimeout(500);
    await page.waitForTimeout(1800);
    if (!await page.locator('.app-shell').count()) throw Error('App shell missing after synthetic demo entry');
    const teaching = page.locator('a[href^="#/teaching/"]').first();
    if (!await teaching.count()) throw Error('No rendered synthetic teaching destination: ' + (await page.locator('body').innerText()).slice(0,1000));
    const teachingHref=await teaching.getAttribute('href');
    for (const theme of ['light','dark']) {
      await page.goto(origin + '#/settings', { waitUntil:'domcontentloaded' });
      await page.waitForTimeout(350);
      await page.locator(`[data-act="theme"][data-theme="${theme}"]`).click();
      await page.waitForTimeout(250);
      const themeStored=await page.locator(`[data-act="theme"][data-theme="${theme}"]`).getAttribute('aria-pressed');
      if (themeStored!=='true') throw Error(`Settings did not persist selected ${theme} theme`);
      for (const surface of ['home','teaching','settings']) {
        const hash=surface==='home'?'#/':surface==='teaching'?teachingHref:'#/settings';
        await page.goto(origin + hash, { waitUntil:'domcontentloaded' });
        await page.waitForTimeout(450);
        await page.keyboard.press('Tab');
        const data=await page.evaluate(()=>{
          const root=getComputedStyle(document.documentElement), body=getComputedStyle(document.body);
          const firstCard=document.querySelector('.card,.section,.today-focus,.teaching-hub,.settings-preference-row');
          const card=firstCard?getComputedStyle(firstCard):null;
          const control=document.querySelector('button:not([disabled]),a[href]');
          const focus=control?getComputedStyle(control):null;
          const active=getComputedStyle(document.activeElement);
          return { title:document.querySelector('h1')?.innerText||document.title, theme:document.documentElement.dataset.theme,
            tokens:{page:root.getPropertyValue('--bg').trim(),raised:root.getPropertyValue('--bg-elev').trim(),subtle:root.getPropertyValue('--bg-sunk').trim(),text:root.getPropertyValue('--text').trim(),text2:root.getPropertyValue('--text-2').trim(),text3:root.getPropertyValue('--text-3').trim(),border:root.getPropertyValue('--border').trim(),borderStrong:root.getPropertyValue('--border-strong').trim(),accent:root.getPropertyValue('--brand').trim(),accentText:root.getPropertyValue('--brand-text').trim(),focusRing:root.getPropertyValue('--action-focus-ring').trim()},
            body:{background:body.backgroundColor,color:body.color}, card:card?{background:card.backgroundColor,color:card.color,border:card.borderColor,borderWidth:card.borderWidth}:null,
            focus:active?{tag:document.activeElement.tagName,outlineStyle:active.outlineStyle,outlineWidth:active.outlineWidth,outlineColor:active.outlineColor,boxShadow:active.boxShadow,focusVisible:document.activeElement.matches(':focus-visible')}:null,
            headings:[...document.querySelectorAll('h1,h2,h3')].slice(0,8).map(x=>({text:x.innerText,level:x.tagName})), controls:document.querySelectorAll('button,a[href]').length,
            scroll:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,viewport:innerWidth+'x'+innerHeight}};
        });
        if (data.theme!==theme) throw Error(`Theme mismatch ${theme} rendered ${data.theme}`);
        if (!data.headings.length||!data.controls) throw Error(`${surface} did not render a useful app hierarchy`);
        if (!data.focus?.focusVisible||data.focus.outlineStyle==='none'||parseFloat(data.focus.outlineWidth)<2) throw Error(`${surface}/${theme} keyboard focus is not visibly outlined`);
        data.contrast={primary:contrast(data.tokens.text,data.tokens.page),secondary:contrast(data.tokens.text2,data.tokens.page),muted:contrast(data.tokens.text3,data.tokens.page),accentLabel:contrast(data.tokens.accentText,data.tokens.page)};
        if (Object.values(data.contrast).some(ratio=>ratio<4.5)) throw Error(`${surface}/${theme} text contrast below 4.5:1: ${JSON.stringify(data.contrast)}`);
        if (data.scroll.width!==viewport.width) throw Error(`${surface}/${theme} horizontal overflow at ${viewport.width}px`);
        if (errors.length) throw Error(`Application errors: ${errors.join('; ')}`);
        const screenshot=`${viewport.width}-${theme}-${surface}.png`;
        await page.screenshot({path:path.join(outDir,screenshot),fullPage:true});
        if (surface==='home') {
          const opposite=theme==='light'?'dark':'light';
          await page.locator('.quick-theme').click();
          await page.waitForTimeout(120);
          if (await page.evaluate(()=>document.documentElement.dataset.theme)!==opposite) throw Error(`N48 quick-theme did not switch ${theme} to ${opposite}`);
          await page.locator('.quick-theme').click();
          await page.waitForTimeout(120);
          if (await page.evaluate(()=>document.documentElement.dataset.theme)!==theme) throw Error(`N48 quick-theme did not restore ${theme}`);
          data.quickTheme='switch and restore PASS';
        }
        rows.push({viewport,theme,surface,themeStored,...data,screenshot});
      }
    }
    await context.close();
  }
});
for (const viewport of [{width:390,height:844},{width:1365,height:768}]) for (const surface of ['home','teaching','settings']) {
  const pair=rows.filter(row=>row.viewport.width===viewport.width&&row.surface===surface);
  if (pair.length!==2||pair[0].scroll.height!==pair[1].scroll.height) throw Error(`${surface} layout changed between themes at ${viewport.width}px`);
}
await fs.writeFile(path.join(outDir,'measurements.json'),JSON.stringify({taskId:'continuous-n26-theme-comfort-representative-slice-20261022',runId,origin,states:rows},null,2)+'\n');
console.log(JSON.stringify({states:rows.length,measurements:path.join(outDir,'measurements.json')}));
