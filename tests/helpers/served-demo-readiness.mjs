/**
 * Real published RAKEEZ Demo readiness. Do not rely on window.store (dev-only).
 * The caller owns a browser lease and uses an isolated Chrome/Chromium context.
 */
export async function openReadyServedDemo(page, base, {timeout=30000}={}) {
  const origin=new URL(base).origin;
  await page.goto(origin+'/#/classes',{waitUntil:'domcontentloaded',timeout});
  await page.locator('.boot').waitFor({state:'detached',timeout});
  await page.waitForFunction(async()=>{
    const store=await import('/src/store.js');
    return store.state.ready===true &&
      store.getActiveWorkspace()?.type==='demo' &&
      !!store.state.device &&
      store.teachings().length>0 &&
      store.state.students.length>0 &&
      !!document.querySelector('.layout');
  },null,{timeout});
  return page.evaluate(async()=>{
    const store=await import('/src/store.js');
    return {workspace:store.getActiveWorkspace()?.type,ready:store.state.ready,
      teachings:store.teachings().length,students:store.state.students.length};
  });
}
export async function makeIsolatedDemoContext(browser,{width=390,height=844}={}) {
  const ctx=await browser.newContext({viewport:{width,height},
    locale:'ar-SA',timezoneId:'Asia/Riyadh',serviceWorkers:'block'});
  await ctx.route('https://*.supabase.co/**',route=>route.abort());
  await ctx.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
  return ctx;
}
