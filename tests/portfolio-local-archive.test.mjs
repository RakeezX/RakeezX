import test from 'node:test';
import assert from 'node:assert/strict';
import {
 buildPortfolioArchive, inspectPortfolioArchive, portfolioArchiveFilename,
 PORTFOLIO_ARCHIVE_KIND, PORTFOLIO_ARCHIVE_VERSION,
} from '../src/lib/portfolio-local-archive.js';

const scope={ownerId:'synthetic-owner-a',yearId:'synthetic-year-1448',
  workspaceDatabase:'rakeezx-user-'+'a'.repeat(32),type:'account'};
const photo=new Blob([Uint8Array.from([137,80,78,71,0,0,0,0,34,56])],{type:'image/png'});
const payload={
  criterionNames:[['04','قيمة خاصة']],hiddenCriteria:['08'],
  extraCriteria:[],customWitnesses:[{id:'custom:04:witness',criterion:'04',
    title:'مشروع فصلي',description:'تجربة تمت كما وثقها المعلم',sourceKind:'custom'}],
  hiddenWitnesses:['template:03:parent-contact'],sectionPreferences:[],
  photoLayouts:[['custom:04:witness','one']],
  photos:[['custom:04:witness',[{id:'image-a',name:'activity.png',bytes:photo.size}]]],
  selectedByCriterion:[['04','custom:04:witness']],descriptions:[],titles:[],
  includedWitnesses:['custom:04:witness'],excludedWitnesses:[],
  editingCriterion:'04',nextExtraCriterionNumber:12,
};
const saved={payload,images:new Map([['image-a',{blob:photo}]]),
  savedAt:'2026-10-26T11:11:00.000Z'};
const failCode=async(work,expected)=>{
  await assert.rejects(work,e=>e?.code===expected);
};

test('a portable F09 backup round-trips every image with SHA-256 and account scope',async()=>{
 const archive=await buildPortfolioArchive(scope,saved);
 const obj=JSON.parse(archive);
 assert.equal(obj.kind,PORTFOLIO_ARCHIVE_KIND);
 assert.equal(obj.version,PORTFOLIO_ARCHIVE_VERSION);
 assert.equal(obj.attachments.length,1);
 assert.match(obj.checksum,/^[a-f0-9]{64}$/);
 assert.equal(archive.includes('blob:'),false);
 const restored=await inspectPortfolioArchive(archive,scope);
 assert.deepEqual(restored.payload,payload);
 assert.equal(restored.images.length,1);
 assert.equal(restored.images[0].id,'image-a');
 assert.deepEqual(new Uint8Array(await restored.images[0].blob.arrayBuffer()),
   new Uint8Array(await photo.arrayBuffer()));
 assert.equal(restored.summary.customWitnesses,1);
 assert.equal(restored.summary.photoCount,1);
 assert.match(portfolioArchiveFilename(scope.yearId,new Date('2026-10-26T13:00:00Z')),
   /synthetic-year-1448-2026-10-26\.json$/);
});

test('a broken checksum, owner or year never restores a foreign archive',async()=>{
 const text=await buildPortfolioArchive(scope,saved);
 await failCode(()=>inspectPortfolioArchive(text,{...scope,ownerId:'teacher-b'}),
   'PORTFOLIO_ARCHIVE_OWNER');
 await failCode(()=>inspectPortfolioArchive(text,{...scope,yearId:'synthetic-year-1449'}),
   'PORTFOLIO_ARCHIVE_OWNER');
 const modified=JSON.parse(text);
 modified.payload.customWitnesses[0].title='Tampered';
 await failCode(()=>inspectPortfolioArchive(JSON.stringify(modified),scope),
   'PORTFOLIO_ARCHIVE_INTEGRITY');
});

test('truncated and incompatible exports cannot be treated as restored data',async()=>{
 const text=await buildPortfolioArchive(scope,saved);
 await failCode(()=>inspectPortfolioArchive(text.slice(0,-20),scope),
   'PORTFOLIO_ARCHIVE_JSON');
 const invalid=JSON.parse(text);invalid.version=99;
 await failCode(()=>inspectPortfolioArchive(JSON.stringify(invalid),scope),
   'PORTFOLIO_ARCHIVE_FORMAT');
 await failCode(()=>inspectPortfolioArchive('{}',scope),
   'PORTFOLIO_ARCHIVE_FORMAT');
});

test('the archive format supports an empty valid document and rejects missing source photos',async()=>{
 const empty={...payload,photos:[],customWitnesses:[]};
 const archive=await buildPortfolioArchive(scope,{
   payload:empty,images:new Map(),savedAt:null,
 });
 assert.equal((await inspectPortfolioArchive(archive,scope)).images.length,0);
 await failCode(()=>buildPortfolioArchive(scope,{
   payload,images:new Map(),savedAt:null,
 }), 'PORTFOLIO_ARCHIVE_INCOMPLETE');
});

// AI N126: both legacy and extended documents keep the original archive version.
test('professional context survives portable archive with photos and remains owner/year bound',async()=>{
 const contexts=[['custom:04:witness',{action:'تجربة اصطناعية',activity:'نشاط',date:'2026-10-20',
   teaching:'فصل تجريبي / مادة',reflection:'ملاحظة نوعية',source:'مصدر محلي'}]];
 const text=await buildPortfolioArchive(scope,{...saved,payload:{...payload,contexts}});
 const restored=await inspectPortfolioArchive(text,scope);
 assert.deepEqual(restored.payload.contexts,contexts);
 const {restorePortfolioDraft}=await import('../src/lib/portfolio-local-state.js');
 const model=restorePortfolioDraft(restored.payload,new Map(restored.images.map(i=>[i.id,i])),{makeUrl:()=>''});
 assert.deepEqual([...model.contexts],contexts);
 await failCode(()=>inspectPortfolioArchive(text,{...scope,yearId:'another-year'}),'PORTFOLIO_ARCHIVE_OWNER');
});
