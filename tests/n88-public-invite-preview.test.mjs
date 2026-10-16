import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../public/n88-invite-preview.html',import.meta.url),'utf8');
test('public invite preview is an independent synthetic static document',()=>{
 assert.match(html,/<!doctype html>/i);assert.match(html,/<html lang="ar" dir="rtl"/);
 assert.match(html,/تجربة افتراضية - لا دخول فعلي ولا بيانات حقيقية/);
 assert.match(html,/مدرسة النور الافتراضية/);assert.match(html,/طالب افتراضي/);assert.match(html,/افتح الدعوة/);
 assert.match(html,/DEMO-ONLY/);assert.match(html,/id="back"/);assert.match(html,/id="resetTop"/);
 assert.match(html,/default-src 'none'/);assert.match(html,/connect-src 'none'/);assert.match(html,/form-action 'none'/);
 assert.doesNotMatch(html,/<(?:link|img|iframe|script)[^>]+(?:src|href)=["'](?:https?:|\/|\.\/)/i);
 assert.doesNotMatch(html,/(?:fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|analytics)/i);
 assert.doesNotMatch(html,/(?:src\/|\.\/src\/|\/src\/|supabase|auth\.sign|studentId|password)/i);
 assert.match(html,/max-width:700px/);assert.match(html,/focus-visible/);assert.match(html,/data-theme="dark"/);
});
