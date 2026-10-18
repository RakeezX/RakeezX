/** AI: current actual N88 composition, fabricated loopback-only manual review. */
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {createCloudflareEntry} from './cloudflare-entry.mjs';
import {A,authUrl,providerFixture} from '../../tests/fixtures/n88-existing-host/provider.mjs';
import {startNativePg,processIdentity} from '../../tests/fixtures/n88-current-review/native-pg.mjs';
export const root=fileURLToPath(new URL('../../',import.meta.url));
const fixture=path.join(root,'tests/fixtures/n88-current-review');
export function ttlSeconds(value=14400) {
  const ttl=Number(value);if(!Number.isInteger(ttl)||ttl<1||ttl>28800)throw Error('TTL must be 1..28800 seconds (default 14400).');return ttl;
}
const readiness={enabled:true,serviceRevision:'n88-existing-host-v1'};
const banner=`<aside class="n88-review" aria-label="إرشادات التجربة"><strong>تجربة تشغيلية ببيانات مصطنعة؛ الخدمة الحية غير مفعلة.</strong><p>المعلم: معلم التجربة المصطنع. الطالب: طالب التجربة المصطنع. البيانات جاهزة؛ لا تستخدم بيانات حساب أو طالب حقيقي.</p><ol><li>في صفحة المعلم اختر طالب التجربة ثم «إدارة وصول الطالب» ثم «إنشاء / تغيير الرمز».</li><li>احتفظ بالرمز المعروض وافتح «فتح صفحة الطالب» أدناه في تبويب جديد، ثم أدخل الرمز هناك. لا تشارك الرابط الخاص.</li><li>عُد للمعلم: أغلق عرض الرمز، واختر الطالب وإدارة وصوله؛ عدّل عنوان النشاط وحدّد «نشر للطالب» ثم احفظ.</li><li>في صفحة الطالب اضغط تحديث لرؤية النشاط وحالته. عدّل الحالة عند المعلم واحفظ ثم حدّث الطالب مرة أخرى.</li><li>للإلغاء: من إدارة وصول الطالب اضغط «إلغاء وصول الطالب»، ثم حدّث صفحة الطالب للتحقق من منع الوصول.</li></ol><a href="/teacher">صفحة المعلم</a><a data-review-student hidden target="_blank" rel="noopener noreferrer">فتح صفحة الطالب</a><p>الطالب يقرأ المتابعة؛ تعديلها من المعلم. تُمسح التجربة عند إيقاف المشغّل أو انتهاء المهلة.</p></aside>`;
export async function startReview({ttl=14400}={}) {
  ttl=ttlSeconds(ttl);
  const {createWebEntry}=await import('./web-entry.mjs');
  const pg=await startNativePg(root);let server,closed=false,timer;
  const close=async()=>{
    if(closed)return;closed=true;clearTimeout(timer);
    if(server?.listening){server.closeAllConnections();await new Promise(ok=>server.close(ok));}
    await pg.close();
  };
  try {
    const origin='https://synthetic.invalid',provider=providerFixture(),ingressKey=randomBytes(32);
    const manifest=JSON.parse(await readFile(path.join(root,'drafts/n88-student-portal/deployment.inactive.json'),'utf8'));
    const activation=JSON.parse(await readFile(path.join(root,'drafts/n88-student-portal/activation/manifest.json'),'utf8'));
    const allow=new Set(activation.graphs['private/assets/student.mjs'].inputs.map(p=>'/'+p.split('?')[0]));
    for(const file of ['src/styles/app.css','src/styles/student-portal.css'])allow.add('/'+file);
    const edge=createWebEntry({...manifest,origin,authUrl,apiKey:'FABRICATED_API_KEY',secretKey:randomBytes(32),ingressKey,
      acquire:()=>pg.acquire(),fetch:provider.fetch,sourceOnly:false,canonicalReadback:true,privateIngressReadback:true});
    const gateway=createCloudflareEntry({fetch:(url,init)=>edge(new Request(url,init))});
    const env={N88_ENABLED:'true',N88_PUBLIC_ORIGIN:origin,N88_EDGE_URL:authUrl+'/functions/v1/n88-student-portal',N88_INGRESS_KEY:ingressKey.toString('hex')};
    let localOrigin;
    server=createServer(async(req,res)=>{
      const send=(status,body,type='text/plain; charset=utf-8')=>{res.writeHead(status,{'content-type':type});res.end(body);};
      res.setHeader('cache-control','no-store, private');res.setHeader('referrer-policy','no-referrer');
      res.setHeader('x-content-type-options','nosniff');res.setHeader('x-frame-options','DENY');
      res.setHeader('content-security-policy',"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; worker-src 'none'");
      try {
        const u=new URL(req.url,localOrigin);
        if(req.headers.host!==new URL(localOrigin).host || req.headers.origin&&req.headers.origin!==localOrigin || req.headers['sec-fetch-site']==='cross-site')return send(403,'Unavailable');
        // Only the existing static module query is allowed, never private query values.
        if(u.search && !(u.pathname==='/src/lib/score-distribution-copy.js'&&u.search==='?n100=automatic-safe-v1'))return send(400,'Unavailable');
        if(u.pathname.startsWith('/api/n88/')) {
          if(!['GET','POST'].includes(req.method))return send(405,'Unavailable');
          let length=0;const chunks=[];for await(const b of req){length+=b.length;if(length>4096)return send(413,'Unavailable');chunks.push(b);}
          const body=Buffer.concat(chunks),headers=new Headers(req.headers);headers.set('origin',origin);headers.set('cf-connecting-ip','192.0.2.1');
          const request=new Request(origin+u.pathname,{method:req.method,headers,...(body.length?{body}:{})});
          // Fabricated ingress metadata ONLY; no network call to either provider.
          Object.defineProperty(request,'cf',{value:{tlsVersion:'TLSv1.3'}});
          const result=await gateway(request,env);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));return;
        }
        if(!['GET','HEAD'].includes(req.method))return send(405,'Unavailable');
        if(u.pathname==='/review/context')return send(200,JSON.stringify({ownerId:A,token:provider.token(),enrollmentId:'enrollment1',revision:1,readiness}),'application/json');
        if(u.pathname==='/review/readiness')return send(200,JSON.stringify(readiness),'application/json');
        if(u.pathname==='/'){res.writeHead(302,{location:'/teacher'});res.end();return;}
        if(u.pathname==='/teacher'||/^\/s\/[A-Za-z0-9_-]{43}$/.test(u.pathname)) {
          const teacher=u.pathname==='/teacher';
          let html=await readFile(path.join(root,'drafts/n88-student-portal/client/student.html'),'utf8');
          // Actual student HTML/entry, with readiness supplied only by this loopback composition.
          html=html.replace('</head>','<link rel="stylesheet" href="/review/shell.css"></head>')
            .replace('<body>','<body>'+banner).replace('</body>','<script type="module" src="/review/shell.js"></script></body>');
          if(teacher)html=html.replace('id="student-portal"','id="review-teacher"').replace('/drafts/n88-student-portal/client/student-entry.js','/review/teacher-entry.js');
          return send(200,html,'text/html; charset=utf-8');
        }
        if(u.pathname==='/drafts/n88-student-portal/client/student-entry.js') {
          const source=await readFile(path.join(root,u.pathname.slice(1)),'utf8');
          const call="mountStudentService(document.getElementById('student-portal'));";
          if(!source.includes(call))throw Error('Student entry changed; review composition needs updating');
          return send(200,source.replace(call,"const readiness = await (await fetch('/review/readiness', { cache: 'no-store' })).json();\nmountStudentService(document.getElementById('student-portal'), { readiness });"),'text/javascript');
        }
        const shell={'/review/teacher-entry.js':'teacher-entry.js','/review/shell.js':'shell.js','/review/shell.css':'shell.css'};
        let file;
        if(Object.hasOwn(shell,u.pathname))file=path.join(fixture,shell[u.pathname]);
        else if(allow.has(u.pathname))file=path.join(root,u.pathname.slice(1));
        else return send(404,'Unavailable');
        const body=await readFile(file);return send(200,req.method==='HEAD'?undefined:body,path.extname(file)==='.css'?'text/css':'text/javascript');
      }catch {if(!res.headersSent)send(503,'Synthetic review unavailable');else res.end();}
    });
    server.requestTimeout=15000;server.headersTimeout=10000;
    await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
    localOrigin='http://127.0.0.1:'+server.address().port;
    const expiresAt=new Date(Date.now()+ttl*1000).toISOString();
    let expire;const expired=new Promise(ok=>{expire=ok;});
    timer=setTimeout(()=>{expire();},ttl*1000);
    return {url:localOrigin+'/teacher',expiresAt,phase:pg.phase,postgres:{...pg.identity,port:pg.port},close,expired};
  }catch(e){await close();throw e;}
}

export const help='N88 current synthetic review (Windows, installed native PG17.6).\nnode drafts/n88-student-portal/current-review.mjs --receipt <local receipt.json> [--ttl-seconds 14400]\nTTL: 1..28800 seconds; default 4 hours, maximum 8.\nUse current-review-launch.ps1 to launch hidden, read the teacher URL, or request owned graceful shutdown. No hosted service is enabled.';
async function main() {
  const args=process.argv.slice(2);if(args.includes('--help')){console.log(help);return;}
  const options={};for(let i=0;i<args.length;i+=2){if(!['--receipt','--ttl-seconds'].includes(args[i])||!args[i+1]||options[args[i]])throw Error('Invalid arguments');options[args[i]]=args[i+1];}
  const ttl=ttlSeconds(options['--ttl-seconds']),receipt=path.resolve(options['--receipt']||'');
  if(!receipt.startsWith(path.join(fixture,'receipts')+path.sep)||path.extname(receipt)!=='.json')throw Error('Receipt must be a fresh JSON file in tests/fixtures/n88-current-review/receipts');
  await mkdir(path.dirname(receipt),{recursive:true});
  try{await stat(receipt);throw Error('Receipt already exists');}catch(e){if(e.code!=='ENOENT')throw e;}
  let review,watch,requested;const signal=new Promise(ok=>{requested=ok;});
  const stop=()=>requested('signal');process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try {
    review=await startReview({ttl});const identity=processIdentity(process.pid);
    const publicReceipt={aiAuthored:true,pid:identity.pid,birth:identity.birth,executable:identity.executable,commandLine:identity.commandLine,url:review.url,expiresAt:review.expiresAt,phase:review.phase,postgres:review.postgres,status:'running'};
    await writeFile(receipt,JSON.stringify(publicReceipt,null,2)+'\n',{flag:'wx'});
    watch=setInterval(async()=>{try{const request=JSON.parse((await readFile(path.join(review.phase,'shutdown.request.json'),'utf8')).replace(/^\uFEFF/,''));if(request.pid===identity.pid&&request.birth===identity.birth)requested('owned-request');}catch{}},250);
    const reason=await Promise.race([signal,review.expired.then(()=>'expired')]);
    await review.close();
    await writeFile(receipt,JSON.stringify({...publicReceipt,status:'stopped',reason,stoppedAt:new Date().toISOString(),cleanup:{httpClosed:true,postgresStopped:true,ownedFilesRemoved:true}},null,2)+'\n');
  }finally{clearInterval(watch);await review?.close();process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{console.error('N88 synthetic review failed; owned cleanup attempted. No private values logged.');process.exitCode=1;});
