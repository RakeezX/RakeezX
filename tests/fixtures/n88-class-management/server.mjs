// AI: owned loopback-only fixture serving the actual module, client and source CSS, not a replacement UI.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export const fields = () => Object.fromEntries(['name','class','grades','required','completed','scheduled'].map(k => [k,false]));
export const context = () => ({ enabled:true, ownerId:'fabricated-owner', sessionId:'fabricated-session', leaseId:'fabricated-lease', teachingId:'teaching-a', classId:'class-a', termId:'term-a', contextRevision:'context-1', validUntil:Date.now()+300000 });
export const roster = () => ({ classId:'class-a', rosterRevision:7, policyRevision:3, visibility:fields(), students:Array.from({length:30}, (_,i) => ({ studentId:'student-'+i, enrollmentId:'enrollment-'+i, revision:2, label:'طالب تجريبي '+(i+1), hasActiveCode:i < 10, credentialVersion:i < 10 ? 1 : 0 })) });
export function createService() {
  let state = roster(), serial = 0;
  return { async respond(path, body) {
    const { binding, requestId = null } = body;
    if (binding.ownerId !== 'fabricated-owner' || binding.classId !== 'class-a' || binding.teachingId !== body.teachingId) return { ok:false };
    let data;
    if (path === 'list') data = structuredClone(state);
    else {
      if (body.expectedRosterRevision !== state.rosterRevision) return { ok:false };
      if (path === 'issue-missing') {
        data = { requestId, created:[], skipped:[], failed:[], uncertain:false };
        const partial = serial === 0;
        for (const s of state.students) {
          if (s.hasActiveCode) data.skipped.push({studentId:s.studentId,reason:'existing'});
          else if (s.studentId === 'student-29' && partial) data.failed.push({studentId:s.studentId,reason:'unavailable'});
          else { s.hasActiveCode=true; s.credentialVersion++; data.created.push({studentId:s.studentId,enrollmentId:s.enrollmentId,credentialVersion:s.credentialVersion,credential:'1'+String(++serial).padStart(11,'0')}); }
        }
      } else if (path === 'visibility') {
        if (body.policyRevision !== state.policyRevision) return {ok:false};
        state.visibility = structuredClone(body.fields); state.policyRevision++;
        data = {updated:true,policyRevision:state.policyRevision,fields:structuredClone(state.visibility)};
      } else {
        const s = state.students.find(s => s.studentId === body.studentId);
        if (!s || !s.hasActiveCode || ['revision','enrollmentId','credentialVersion'].some(k => s[k] !== body[k])) return {ok:false};
        s.credentialVersion++; s.hasActiveCode=path==='rotate';
        data = {[path==='rotate'?'rotated':'revoked']:true,studentId:s.studentId,enrollmentId:s.enrollmentId,credentialVersion:s.credentialVersion};
        if (path==='rotate') data.credential='1'+String(++serial).padStart(11,'0');
      }
      state.rosterRevision++;
    }
    return {ok:true,body:{ack:true,binding,requestId,data}};
  } };
}
export async function startClassServer() {
  let service = createService();
  const allowed = new Set(['/src/views/student-portal-class.js','/src/lib/student-portal-class-client.js','/src/styles/student-portal-class.css','/src/styles/app.css','/tests/fixtures/n88-class-management/entry.js']);
  const server = createServer(async (req,res) => {
    res.setHeader('Cache-Control','no-store'); res.setHeader('Referrer-Policy','no-referrer');
    try {
      if (req.url.startsWith('/api/n88/teacher/class/')) {
        let raw=''; for await (const chunk of req) { raw+=chunk; if(raw.length>10000) throw Error('bounded'); }
        const response=await service.respond(req.url.split('/').pop(),JSON.parse(raw));
        res.writeHead(response.ok?200:409,{'Content-Type':'application/json'});res.end(JSON.stringify(response.body??{}));return;
      }
      if(req.url==='/') {res.setHeader('Content-Type','text/html');res.end(await readFile(new URL('./index.html',import.meta.url)));return;}
      if(!allowed.has(req.url)) {res.writeHead(404);res.end();return;}
      res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'text/javascript');res.end(await readFile(resolve('.'+req.url)));
    }catch{res.writeHead(400);res.end();}
  });
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
  return {url:'http://127.0.0.1:'+server.address().port, reset(){service=createService();}, async close(){server.closeAllConnections();await new Promise(ok=>server.close(ok));}};
}
