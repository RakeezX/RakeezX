/**
 * Isolated-candidate UX: show the actual impact of changing a subject.
 * There is deliberately NO replacement write button until the new
 * owner/lease/server CAS, Sync V2 receipt, and N71 V2 release are verified.
 */
import {openSheet} from '../lib/dom.js';
import * as store from '../store.js';
import {previewTeachingSubjectChange} from '../lib/teaching-subject-change-preview.js';

const node=(tag,className='',content='')=>{
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(content)el.textContent=content;
  return el;
};
const guide={
  preflight_ready:'لا توجد درجات أو حصص أو أعمال مرتبطة تمنع تصحيح الاختيار محليًا. لا يزال الحفظ السحابي لهذا التغيير غير مفعّل؛ لن تتغير المادة حتى يتوفر مسار آمن معتمد.',
  review_required:'توجد سجلات مرتبطة بهذه المادة أو تغييرات تنتظر المزامنة. لا يجوز تحويل درجاتها أو حصصها إلى مادة أخرى تلقائيًا. يمكنك إضافة مادة مستقلة مع الاحتفاظ بالتاريخ السابق.',
  target_exists:'المادة المحددة مرتبطة بهذا الفصل بالفعل. افتحها من قائمة الفصول بدل إنشاء نسخة ثانية أو دمج سجلات مختلفتين.',
  blocked:'لا يمكن تقييم تغيير المادة بأمان من البيانات المتاحة حاليًا. لم يتغير أي سجل.',
  unchanged:'اختر مادة أخرى لمعاينة أثر التغيير. مادة الفصل الحالية لم تتغير.',
};
const impactFields=['scores','attendance','sessions','slots','logs','notes',
  'scoreSubitems','scoreSubitemCompletions','assignments','submissions',
  'closedTermReports','teachingCourseBindings','sectionCurriculumScopes','outbox'];
export async function openTeachingSubjectChangePreview(teachingId,{onAdd=()=>{}}={}) {
  const initial=store.assertClassOperationsAccess(teachingId);
  const workspace=store.getActiveWorkspace();
  const section=store.getSection(initial.sectionId);
  const term=store.getTerm(initial.termId);
  const currentSubject=store.getSubject(initial.subjectId);
  const ownerId=workspace?.authUserId??'demo-local-subject-preview';
  const choices=store.subjects().filter(row=>row.id!==initial.subjectId);
  const assertContext=()=>{
    if(store.getActiveWorkspace()!==workspace||!store.state.ready||
       store.getTeaching(teachingId)?.subjectId!==initial.subjectId||
       store.getTeaching(teachingId)?.sectionId!==initial.sectionId||
       store.getTeaching(teachingId)?.termId!==initial.termId||
       store.getSection(section.id)?.yearId!==section.yearId||
       store.activeTerm()?.id!==term?.id)
      throw new Error('تغير الفصل أو الحساب أثناء المعاينة. أعد فتح التعديل.');
    store.assertClassOperationsAccess(teachingId);
  };
  const result=await openSheet({
    title:'تغيير مادة الفصل',
    desc:'معاينة الأثر قبل تغيير المادة، دون تعديل الدرجات أو كشوف الطلاب.',
    onMount(root,done){
      const body=root.querySelector('.sheet__body');
      const current=node('div','field mb-3');
      const currentLabel=node('span','field__label','المادة الحالية');
      current.append(currentLabel,node('strong','',currentSubject?.name??'غير معروفة'));
      body.append(current);

      const field=node('label','field mb-3');
      const text=node('span','field__label','المادة الجديدة');
      const select=node('select','select');
      select.setAttribute('aria-label','المادة الجديدة');
      const placeholder=node('option','',choices.length?'اختر مادة لمعاينة الأثر':'لا توجد مادة أخرى محفوظة');
      placeholder.value='';placeholder.selected=true;
      select.append(placeholder);
      for(const subject of choices){
        const option=node('option','',subject.name);
        option.value=subject.id;
        select.append(option);
      }
      select.disabled=choices.length===0;
      field.append(text,select);
      body.append(field);

      const summary=node('div','card card--pad mb-3');
      summary.setAttribute('role','status');
      summary.setAttribute('aria-live','polite');
      summary.textContent='الدرجات والحضور والتقارير مرتبطة بالمادة الحالية، ولا تُنقل تلقائيًا.';
      body.append(summary);

      const hint=node('p','field__hint mb-3',
        'هذا فحص محلي للمعاينة فقط. لا يتم تغيير المادة أو إرسال بيانات عند فتح الشاشة.');
      body.append(hint);
      const actions=node('div','hstack gap-2 wrap justify-end');
      const add=node('button','btn btn--quiet','إضافة مادة أخرى مع الحفاظ على السجلات');
      add.type='button';
      add.setAttribute('data-add-independent-subject','');
      const preview=node('button','btn btn--primary','معاينة أثر التغيير');
      preview.type='button';preview.disabled=true;
      preview.setAttribute('data-review-subject-change','');
      const cancel=node('button','btn btn--ghost','إغلاق');
      cancel.type='button';
      actions.append(cancel,add,preview);
      body.append(actions);
      cancel.addEventListener('click',()=>done(null));
      add.addEventListener('click',()=>done('add'));

      let requestSerial=0;
      select.addEventListener('change',()=>{
        requestSerial++;
        preview.disabled=!select.value;
        summary.textContent='اختَر معاينة الأثر للاطلاع على السجلات المرتبطة بالمادة الجديدة.';
      });
      preview.addEventListener('click',async()=>{
        if(!select.value||preview.disabled)return;
        const serial=++requestSerial;
        const subjectId=select.value;
        preview.disabled=true;
        summary.textContent='جار فحص سجلات المادة محليًا دون إجراء تغييرات…';
        try{
          const report=await previewTeachingSubjectChange({
            ownerId,teachingId,targetSubjectId:subjectId,currentTermId:term.id,
            assertContext,
          });
          if(serial!==requestSerial||!root.isConnected)return;
          summary.replaceChildren();
          const label=node('strong','mb-2','نتيجة المعاينة');
          const message=node('p','mb-2',guide[report.status]??guide.blocked);
          summary.append(label,message);
          if(report.reason==='pending_sync_requires_reconciliation'){
            summary.append(node('p','field__hint',
              'يوجد حفظ لم تكتمل مزامنته. لا تُجرِ تعديلًا آخر حتى تتضح نتيجة العملية السابقة.'));
          }
          if(report.affected){
            const total=node('p','field__hint','طلاب الفصل المشترك: '+
              String(report.affected.sharedStudents??0)+
              ' · سجلات مرتبطة: '+String(report.affected.totalLinkedRows??0));
            summary.append(total);
            const entries=impactFields
              .map(name=>report.affected.recordCounts?.[name])
              .filter(item=>item?.count>0);
            if(entries.length){
              const list=node('ul','');
              for(const item of entries){
                const line=node('li','',item.label+': '+String(item.count));
                list.append(line);
              }
              summary.append(list);
            }
          }
          if(report.status==='preflight_ready'){
            summary.append(node('p','field__hint',
              'معاينة ناجحة، لكن خيار الحفظ المباشر لم يُفعّل قبل اختبار الخادم والمزامنة والاستعادة.'));
          }
        }catch{
          if(serial!==requestSerial||!root.isConnected)return;
          summary.textContent='تعذّرت معاينة السجلات في هذا الحساب. لم يُجرَ أي تعديل.';
        }finally{
          if(serial===requestSerial&&root.isConnected)preview.disabled=!select.value;
        }
      });
    },
  });
  if(result==='add'){
    // Existing Product workflow: separate subject teaching and shared roster.
    // No new path for cross-subject grade/attendance transfer is introduced.
    return onAdd(section.id);
  }
  return null;
}
