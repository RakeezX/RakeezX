/** AI-authored. Server-only AEAD; never accepts ciphertext from an HTTP caller. */
import {Buffer} from 'node:buffer';
import {randomBytes,randomUUID,createCipheriv,createDecipheriv} from 'node:crypto';
const fail=()=>{throw Error('n88_recovery_unavailable');};
const ver=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,40}$/.test(v);
const exact=(o,ks)=>o&&Object.keys(o).length===ks.length&&ks.every(k=>Object.hasOwn(o,k));
const fields=['id','credentialId','generation','envelopeVersion','algorithm','keyVersion','nonce','ciphertext','tag'];
export function createCodeRecovery({keys,activeKeyVersion,otherKeys=[]}={}) {
  if(!(keys instanceof Map)||!keys.size||keys.size>8||!ver(activeKeyVersion)||!keys.has(activeKeyVersion)||
    [...keys].some(([v,k])=>!ver(v)||!Buffer.isBuffer(k)||k.length!==32)||
    new Set([...keys.values()].map(k=>k.toString('hex'))).size!==keys.size||
    [...keys.values()].some(k=>otherKeys.some(o=>Buffer.isBuffer(o)&&k.equals(o))))fail();
  keys=new Map([...keys].map(([v,k])=>[v,Buffer.from(k)]));
  const aad=(c,e)=>Buffer.from(JSON.stringify(['n88-code-recovery',e.id,e.envelopeVersion,e.algorithm,e.keyVersion,c.id,c.version,c.ownerId,c.studentId,c.format,e.generation]));
  function seal(c,code,generation=1) {
    if(c.revokedAt!==null||c.format!=='six-v1'||!/^1[0-9]{5}$/.test(code)||!Number.isSafeInteger(generation)||generation<1)fail();
    const e={id:randomUUID(),credentialId:c.id,generation,envelopeVersion:1,algorithm:'AES-256-GCM',keyVersion:activeKeyVersion,nonce:randomBytes(12).toString('hex')};
    const cipher=createCipheriv('aes-256-gcm',keys.get(activeKeyVersion),Buffer.from(e.nonce,'hex'),{authTagLength:16});
    cipher.setAAD(aad(c,e));e.ciphertext=Buffer.concat([cipher.update(code,'ascii'),cipher.final()]).toString('hex');e.tag=cipher.getAuthTag().toString('hex');return e;
  }
  function open(c,e) {
    try {
      if(c.revokedAt!==null||c.format!=='six-v1'||!exact(e,fields)||e.credentialId!==c.id||e.envelopeVersion!==1||e.algorithm!=='AES-256-GCM'||!keys.has(e.keyVersion)||!Number.isSafeInteger(e.generation)||e.generation<1||
        !/^[a-f0-9]{24}$/.test(e.nonce)||!/^[a-f0-9]{12}$/.test(e.ciphertext)||!/^[a-f0-9]{32}$/.test(e.tag))fail();
      const d=createDecipheriv('aes-256-gcm',keys.get(e.keyVersion),Buffer.from(e.nonce,'hex'),{authTagLength:16});d.setAAD(aad(c,e));d.setAuthTag(Buffer.from(e.tag,'hex'));
      const code=Buffer.concat([d.update(Buffer.from(e.ciphertext,'hex')),d.final()]).toString('ascii');if(!/^1[0-9]{5}$/.test(code))fail();return code;
    }catch{fail();}
  }
  // Caller has freshly authorized exact current owner/member/credential BEFORE this query.
  async function read(ports,c) {
    const r=await ports.query('select payload from n88_private.code_recovery where credential_id=$1::uuid order by generation desc limit 1',[c.id]);
    return r.rows.length?{status:'recoverable',credential:open(c,r.rows[0].payload)}:{status:'legacy',credential:null};
  }
  async function append(ports,c,code,generation=1) {
    // Same global fenced transaction as credential insertion. Permanent UNIQUE(key,nonce)
    // ledger includes retired generations and revoked credentials across every instance/restart.
    // Retry ONLY a proven nonce collision, never an unknown/failed transaction/COMMIT.
    for(let n=0;n<8;n++) {
      const e=seal(c,code,generation);
      const r=await ports.query(`insert into n88_private.code_recovery(row_key,payload) values($1,$2::jsonb) on conflict(key_version,nonce) do nothing`,[e.id,JSON.stringify(e)]);
      if(r.rowCount===1)return;
    }fail();
  }
  async function rewrap(ports,c,expectedGeneration) {
    const r=await ports.query('select payload from n88_private.code_recovery where credential_id=$1::uuid order by generation desc limit 1',[c.id]);
    if(r.rows.length!==1||r.rows[0].payload.generation!==expectedGeneration)fail();
    await append(ports,c,open(c,r.rows[0].payload),expectedGeneration+1);
  }
  return Object.freeze({read,append,rewrap,seal,open});
}
