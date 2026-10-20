// AI: names-only boundary shared verbatim with the private MV3 package.
export const RECEIVER_CAPABILITY = 'source-profile-quiet-v1';
export const HANDOFF_TTL = 120000;
// AI: v3 carries only the already-supported, explicitly read setup categories.
export function validateSetupCategories(categories) {
  const specs={teacher:['name'],school:['name'],principal:['name'],classes:['classroom','subject'],timetable:['weekday','period','time','classroom','subject']};
  if(!Array.isArray(categories)||categories.length>5)throw Error('HANDOFF_SETUP');
  const seen=new Set();let count=0;
  return categories.map(c=>{
    if(!c||Object.getPrototypeOf(c)!==Object.prototype||Object.keys(c).sort().join()!=='category,provenance,rows'||!specs[c.category]||seen.has(c.category)||
       !Array.isArray(c.provenance)||c.provenance.length!==1||c.provenance[0]!=='teacher-readonly-run'||!Array.isArray(c.rows)||!c.rows.length||c.rows.length>300)throw Error('HANDOFF_SETUP');
    seen.add(c.category);count+=c.rows.length;if(count>600||['teacher','school','principal'].includes(c.category)&&c.rows.length!==1)throw Error('HANDOFF_SETUP');
    const rows=c.rows.map(row=>{
      if(!row||Object.getPrototypeOf(row)!==Object.prototype||Object.keys(row).some(k=>!specs[c.category].includes(k)))throw Error('HANDOFF_SETUP');
      for(const k of specs[c.category]){
        if((c.category==='timetable'&&['time','period'].includes(k)||c.category==='classes'&&k==='subject')&&row[k]==null)continue;
        if(typeof row[k]!=='string'||row[k]!==row[k].normalize('NFC').trim().replace(/\s+/g,' ')||!row[k]||row[k].length>80||!(/^[\p{L}\p{M}0-9 ():-]+$/u.test(row[k])))throw Error('HANDOFF_SETUP');
      }
      return {...row};
    });return {...c,rows};
  });
}
export const APP_ORIGIN = 'https://rakeezx.com';
export function handoffRoute(extensionId, nonce) {
  if (!/^[a-p]{32}$/.test(extensionId) || !/^[a-f0-9]{64}$/.test(nonce)) throw Error('HANDOFF_KEY');
  return '#/classes/koshoof?import=1&extension=' + extensionId + '&handoff=' + nonce;
}
export function validateHandoff(value, now = Date.now()) {
  const keys = (o, expected) => {
    if (!o || Object.getPrototypeOf(o) !== Object.prototype || Object.keys(o).sort().join() !== [...expected].sort().join()) throw Error('HANDOFF_SCHEMA');
  };
  const automatic = [2,3].includes(value?.version);
  keys(value, ['schema','version','source','scope','createdAt','expiresAt','rows',...(automatic ? ['batchId','complete'] : []),...(value?.version===3?['setup']:[])]);
  if (automatic && (!/^[a-f0-9]{64}$/.test(value.batchId) || typeof value.complete !== 'boolean' || value.source !== 'madrasati')) throw Error('HANDOFF_BATCH');
  if (value.version===3)validateSetupCategories(value.setup);
  if (value.schema !== 'rakeez-extension-names' || ![1,2,3].includes(value.version) ||
      !['madrasati','noor'].includes(value.source) ||
      value.scope !== (value.source === 'noor' ? 'selected-visible-partial' : 'reviewed-run') ||
      !Number.isSafeInteger(value.createdAt) || !Number.isSafeInteger(value.expiresAt) ||
      value.createdAt > now + 5000 || value.expiresAt <= now || value.expiresAt - value.createdAt !== HANDOFF_TTL ||
      !Array.isArray(value.rows) || !value.rows.length || value.rows.length > 300 ||
      new TextEncoder().encode(JSON.stringify(value)).length > 100000) throw Error('HANDOFF_LIMIT_OR_EXPIRED');
  const seen = new Set();
  const rows = value.rows.map(row => {
    keys(row, ['name','classroom']);
    for (const field of ['name','classroom']) {
      const v = row[field];
      if (typeof v !== 'string' || v !== v.normalize('NFC').trim().replace(/\s+/g, ' ') || v.length < 2 || v.length > 80 ||
          !(field === 'name' ? /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u : /^[\p{L}\p{M}0-9 ()-]+$/u).test(v) ||
          !/[\p{L}]/u.test(v)) throw Error('HANDOFF_VALUE');
    }
    const key = [row.classroom,row.name].map(v=>v.replace(/[\s\u0640\u064B-\u065F\u0670]/g,'').toLowerCase()).join('|');
    if (seen.has(key)) throw Error('HANDOFF_DUPLICATE');
    seen.add(key); return { name:row.name, classroom:row.classroom };
  });
  return { ...value, rows };
}
export function handoffBundle(value, now = Date.now()) {
  const e = validateHandoff(value, now);
  return {schema:'rakeez-private-teacher-setup',version:1,categories:[{
    category:'students', provenance:[e.source === 'noor' ? 'selected-visible' : 'teacher-readonly-run'], rows:e.rows,
  }]};
}
