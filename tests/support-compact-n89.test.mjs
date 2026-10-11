import test from 'node:test';
import assert from 'node:assert/strict';
import {supportWhatsAppMessage} from '../src/lib/support-whatsapp.js';
import {buildNotificationEmail} from '../supabase/functions/support-notification-worker/core.mjs';

const diagnostics = {
  environment: 'production', appVersion:'1.0.0', buildSha:'a'.repeat(64), buildShaKind:'content',
  operatingSystem:'windows', deviceCategory:'desktop', browser:'chrome',browserVersion:'154.0.0.0',
  routeCategory:'classes',routeTemplate:'/classes',viewport:{width:1550,height:800},
  online:true,syncState:'syncing',pendingCount:0,failedCount:0,blockedCount:0,
  rejectedCount:0,historicalConflictCount:27,actionableSyncIssue:false,
  rawUserAgent:'secret-ua',token:'secret-token',studentName:'secret-student',
};
test('compact email and WhatsApp preserve identical safe operational facts', () => {
  const whatsapp=supportWhatsAppMessage({type:'technical', diagnostics});
  const email=buildNotificationEmail({id:'support:compact',type:'technical',message:'اختبار',
    created_at:'2026-10-11T09:00:00.000Z',diagnostics},{to:'test@example.com'});
  assert.equal(email.ok,true);
  const w=whatsapp.split('معلومات تقنية:\n')[1].trim().split('\n');
  const e=email.payload.text.split('معلومات تقنية:\n')[1].trim().split('\n');
  assert.deepEqual(w,e);
  assert.ok(w.length <= 6, 'No per-field line expansion');
  assert.match(w.join('\n'), /البيئة: الإنتاج • التطبيق: 1\.0\.0 • البصمة: a{12}/);
  assert.match(w.join('\n'), /النظام: Windows • الجهاز: كمبيوتر • المتصفح: chrome 154/);
  assert.match(w.join('\n'), /الصفحة: \/classes • الشاشة: 1550×800/);
  assert.match(w.join('\n'), /المزامنة: جارية • معلق: 0 • فاشل: 0/);
  assert.match(w.join('\n'), /تعارضات سابقة: 27 • إجراء مطلوب: لا/);
  assert.doesNotMatch(whatsapp+email.payload.text, /secret-ua|secret-token|secret-student|studentName/);
});
