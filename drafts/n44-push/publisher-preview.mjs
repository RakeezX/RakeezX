// AI: local-only UI wired to the actual prepared model and central date adapter.
import { createPublisherPreparation } from './publisher-model.mjs';
import { defaultChannelPreferences } from '../../src/lib/notification-preferences.js';
import { mountDateTimeControls } from '../../src/lib/rakeez-datetime.js';
import { ensureThmanyahFont } from '../../src/lib/thmanyah-font.js';
if(location.hostname!=='127.0.0.1'||!['http:','https:'].includes(location.protocol))throw Error('Local Publisher Preview only');
await ensureThmanyahFont();
const form=document.querySelector('#publisher-form'), status=document.querySelector('#publisher-status');
const preview=document.querySelector('.publisher-preview'),test=document.querySelector('[data-publisher-test]'),cancel=document.querySelector('[data-publisher-cancel]');
const model=createPublisherPreparation();let current=null;
const field=name=>form.elements.namedItem(name);
const parts=(epoch,timezone='Asia/Riyadh')=>Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(epoch).map(p=>[p.type,p.value]));
for(const [prefix,offset] of [['start',3600000],['expiry',86400000]]) {
  const p=parts(Date.now()+offset);field(prefix+'Date').value=`${p.year}-${p.month}-${p.day}`;field(prefix+'Time').value=`${p.hour}:${p.minute}`;
}
mountDateTimeControls(form);
const messages={invalid:'راجع الحقول والقنوات المطلوبة.',invalid_interval:'اختر موعدًا لاحقًا وانتهاءً بعده خلال 7 أيام.',invalid_timezone:'اكتب منطقة زمنية IANA صحيحة.',ambiguous_time:'هذا الوقت يتكرر عند تغيير التوقيت الصيفي؛ اختر وقتًا آخر.',nonexistent_time:'هذا الوقت غير موجود عند تغيير التوقيت الصيفي؛ اختر وقتًا آخر.',capacity:'بلغت المعاينة حد المسودات المحلية.'};
const invalidate=()=>{if(current)status.textContent='تغيّرت المسودة. احفظها لتحديث المعاينة.';test.disabled=true;cancel.disabled=!current;};
form.addEventListener('input',invalidate);
form.addEventListener('change',()=>{
  const scheduled=field('mode').value==='scheduled';
  for(const name of ['startDate','startTime']) {field(name).disabled=!scheduled;field(name).required=scheduled;}
  field('critical').disabled=field('category').value!=='account';if(field('critical').disabled)field('critical').checked=false;
  if(field('critical').checked)field('inApp').checked=true;
  field('inApp').disabled=field('critical').checked;
  invalidate();
});
const draft=()=>({title:field('title').value,body:field('body').value,category:field('category').value,critical:field('critical').checked,
  channels:Object.fromEntries(['inApp','push','email'].map(k=>[k,field(k).checked])),audience:field('audience').value,actionPath:field('actionPath').value,
  start:{mode:field('mode').value,date:field('startDate').value,time:field('startTime').value,timezone:field('timezone').value},
  expiry:{date:field('expiryDate').value,time:field('expiryTime').value,timezone:field('timezone').value}});
const fixture=(key,operator,selected)=>({synthetic:true,key,operator,selected,preferences:defaultChannelPreferences(),
  capabilities:{verifiedAccount:true,pushConsent:true,registrationCurrent:true,permission:'granted',emailVerified:true,emailConsent:false},timing:{timezone:field('timezone').value,quiet:null}});
const showResult=(name,result)=>{
  const node=document.createElement('p');node.className='publisher-result';node.dataset.previewStatus=result.status;
  const labels={preview_only:'معاينة فقط',scheduled:'مجدول للتحضير',expired:'انتهت الصلاحية',outside_audience:'خارج الجمهور',suppressed:'لا توجد قناة مسموحة',audience_unavailable:'ربط الشرائح غير متاح',duplicate_preview:'عُرضت هذه المعاينة سابقًا',blocked:'غير متاح'};
  const channels={inApp:'داخل ركيز',push:'الجهاز',email:'البريد'};
  node.textContent=name+': '+(labels[result.status]??'غير متاح')+(result.channels?' — '+Object.entries(result.channels).filter(([,v])=>v).map(([k])=>channels[k]).join('، '):'');
  preview.querySelector('[data-preview-outcomes]').append(node);
};
form.addEventListener('submit',event=>{
  event.preventDefault();const result=model.save(draft());
  if(!result.id){status.textContent=messages[result.status]??'تعذر حفظ التحضير.';return;}
  current=result;preview.hidden=false;
  preview.querySelector('[data-preview-title]').textContent=current.draft.title;
  preview.querySelector('[data-preview-body]').textContent=current.draft.body;
  preview.querySelector('[data-preview-route]').textContent='الوجهة: '+current.draft.actionPath;
  const time=preview.querySelector('[data-preview-time]');time.replaceChildren();
  for(const [label,epoch] of [['البدء',current.startsAt],['الانتهاء',current.expiresAt]]) {
    const row=document.createElement('span'),value=document.createElement('bdi'),p=parts(epoch,current.draft.expiry.timezone);
    value.dir='ltr';value.textContent=`${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
    row.append(label+': ',value);time.append(row,document.createElement('br'));
  }
  const zone=document.createElement('bdi');zone.dir='ltr';zone.textContent=current.draft.expiry.timezone;time.append(zone);
  preview.querySelector('[data-preview-outcomes]').replaceChildren();
  if(current.draft.audience!=='operator')for(const r of [fixture('sample-a',false,true),fixture('sample-b',false,false)])showResult(r.key==='sample-a'?'عينة مختارة':'عينة أخرى',model.preview(current.id,r));
  status.textContent='حُفظ التحضير المحلي. لم يُرسل أي إشعار.';test.disabled=false;cancel.disabled=false;
});
test.addEventListener('click',()=>{if(!current)return;showResult('المشرف الاصطناعي',model.preview(current.id,fixture('operator',true,true)));});
cancel.addEventListener('click',()=>{if(!current)return;model.cancel(current.id);test.disabled=true;cancel.disabled=true;status.textContent='أُلغي التحضير المحلي. لا توجد عملية إرسال لإلغائها.';});
