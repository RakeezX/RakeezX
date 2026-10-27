import test from 'node:test';
import assert from 'node:assert/strict';
import {compactSubjectLabel} from '../src/lib/subject-catalog.js';
import {compactSectionLabel} from '../src/lib/class-order.js';

test('canonical and prior teacher labels remain intact while display is compact',()=>{
 const section=Object.freeze({id:'s1',grade:4,label:'1',name:'4/1'});
 const subject=Object.freeze({id:'a',name:'المهارات الرقمية'});
 const before=JSON.stringify({section,subject});
 assert.equal(compactSectionLabel(section),'رابع/1');
 assert.equal(compactSubjectLabel(subject,[subject]),'رقمية');
 assert.equal(JSON.stringify({section,subject}),before);
});

test('all stages have recognizably short grade names without losing section identity',()=>{
 const grades={1:'أول',2:'ثاني',3:'ثالث',4:'رابع',5:'خامس',6:'سادس',
 7:'أول م',8:'ثاني م',9:'ثالث م',10:'أول ث',11:'ثاني ث',12:'ثالث ث'};
 for(const [grade,word] of Object.entries(grades))
   assert.equal(compactSectionLabel({grade:Number(grade),label:'2'}),word+'/2');
 assert.equal(compactSectionLabel({grade:5,label:'الخامس الابتدائي / 3'}),'خامس/3');
 assert.equal(compactSectionLabel({grade:5,label:'خامس / أ'}),'خامس/أ');
 assert.equal(compactSectionLabel({grade:5,label:'تجريبي 5'}),'خامس/تجريبي 5');
 assert.equal(compactSectionLabel({grade:99,label:'خاص'}),'خاص');
 assert.equal(compactSectionLabel(null),'');
});

test('long known subjects shorten without conflating different school materials',()=>{
 const cases=[
  ['المهارات الرقمية','رقمية'],
  ['اللغة الإنجليزية','إنجليزي'],
  ['المهارات الحياتية والأسرية','حياتية وأسرية'],
  ['التربية البدنية والدفاع عن النفس','بدنية ودفاع'],
  ['الدراسات الاجتماعية','اجتماعيات'],
  ['التقنية الرقمية','تقنية رقمية'],
  ['القرآن الكريم والدراسات الإسلامية','قرآن وإسلامية'],
  ['الدراسات الإسلامية','إسلامية'],
  ['اللغة العربية','عربية'],
 ];
 for(const [full,short] of cases)
   assert.equal(compactSubjectLabel({id:full,name:full}),short,full);
 assert.notEqual(compactSubjectLabel({id:'digital',name:'المهارات الرقمية'}),
   compactSubjectLabel({id:'technology',name:'التقنية الرقمية'}));
 assert.notEqual(compactSubjectLabel({id:'phys',name:'التربية البدنية والدفاع عن النفس'}),
   compactSubjectLabel({id:'school',name:'التربية البدنية'}));
});

test('unknown custom names must remain full, and collisions use full names',()=>{
 const custom=Object.freeze({id:'other',name:'المشاريع الرقمية المتقدمة وتقنية المعلومات'});
 assert.equal(compactSubjectLabel(custom),'المشاريع الرقمية المتقدمة وتقنية المعلومات');
 const x={id:'id-1',name:'اللغة العربية'};
 const y={id:'id-2',name:'العربية'};
 assert.equal(compactSubjectLabel(x,[x,y]),'اللغة العربية');
 assert.equal(compactSubjectLabel(y,[x,y]),'العربية');
 assert.equal(compactSubjectLabel({id:'id-1',name:'اللغة العربية'},
   [{id:'id-2',name:'اللغة الإنجليزية'}]),'عربية');
 assert.equal(compactSubjectLabel(null),'');
});
