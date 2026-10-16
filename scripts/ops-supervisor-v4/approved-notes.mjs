import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const digest=b=>createHash('sha256').update(b).digest('hex');
export async function readApprovedNotes(repo,activationId) {
  const file=path.join(repo,'docs','PRODUCT_LEDGER.md');
  let text;try{const s=await fs.stat(file);if(s.size>3000000)throw Error('Notes exceed bounded size');text=await fs.readFile(file,'utf8');}catch(e){if(e.code==='ENOENT')return {cards:[],issues:[],openProducts:[]};throw e;}
  const cards=[],issues=[],openProducts=[],seen=new Set();
  for(const line of text.split(/\r?\n/)){
    const c=line.split('|');if(c.length!==13||!/^N\d+$/.test(c[1]?.trim())||!/^\d{4}-\d\d-\d\d$/.test(c[2]?.trim()))continue;
    const productId=c[1].trim(),status=c[7].trim();
    if(/\b(CLOSED|DEFERRED|FROZEN|REJECTED|SUPERSEDED|WAITING_DEPENDENCY)\b/i.test(status))continue;
    openProducts.push(productId);
    const refs=[...c[11].matchAll(/\[\[OPS_TASK:([a-z0-9-]+\.json):([a-f0-9]{64})\]\]/g)];
    for(const m of refs){try{
      const p=path.join(repo,'scripts','ops-supervisor-v4',m[1]),st=await fs.lstat(p);if(st.isSymbolicLink()||!st.isFile()||st.size>256000)throw Error('Invalid note source file');
      const raw=await fs.readFile(p);if(digest(raw)!==m[2])throw Error('Approved source hash differs');
      const source=JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,''));
      if(source.version!==1||source.activationId!==activationId||!Array.isArray(source.tasks)||!source.tasks.length)throw Error('Source activation/schema differs');
      for(const card of source.tasks){
        if(card.productId!==productId||card.activationId!==activationId||!/^[-a-z0-9._]{1,160}$/.test(card.id??'')||!card.objective||!card.releaseAuthority||!card.scopeKey||!card.allowedPaths?.length||!card.requiredChecks?.length)throw Error('Incomplete approved note card');
        if(!seen.has(card.id)){cards.push({...card,approvedNote:{productId,source:m[1],sha256:m[2]}});seen.add(card.id);}
      }
    }catch(e){issues.push({code:'APPROVED_NOTE_UNAVAILABLE',productId,source:m[1],message:e.message});}}
  }
  return {cards,issues,openProducts:[...new Set(openProducts)]};
}
