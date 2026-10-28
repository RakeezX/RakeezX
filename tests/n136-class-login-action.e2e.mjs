import {test,expect} from '@playwright/test';
import {openReadyServedDemo} from './helpers/served-demo-readiness.mjs';
test.use({viewport:{width:320,height:844},serviceWorkers:'block'});
test.beforeEach(async({context})=>{
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  return url.origin==='http://127.0.0.1:5198'&&['GET','HEAD'].includes(route.request().method())
    ?route.continue():route.abort('blockedbyclient');
 });
 await context.addInitScript(()=>sessionStorage.setItem('rakeezx-demo-session-v1','preparing'));
});
test('class access feedback provides direct login flow without changing identity guards',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-09-09T08:20:00+03:00'));
 await openReadyServedDemo(page,'http://127.0.0.1:5198');
 await page.goto('/#/teaching/missing-fixture');
 const notice=page.locator('[data-class-access-status="verification"]');
 await expect(notice).toBeVisible();
 await expect(notice).toContainText('يلزم تسجيل الدخول');
 await expect(notice).toContainText('بياناتك المحلية محفوظة');
 const login=notice.getByRole('button',{name:'تسجيل الدخول'});
 await expect(login).toBeVisible();
 await login.click();
 await expect(page.locator('#mini-hub-login-form')).toBeVisible();
 await expect(notice).toBeVisible();
});
