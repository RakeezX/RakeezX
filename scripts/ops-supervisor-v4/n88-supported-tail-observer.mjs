// Reviewed operations-only observer. No Product code, credential reads or raw logs.
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const repo='C:/Users/Abody/Projects/RakeezX',task='continuous-n88-current-teacher-connection-actual-cause-20261020',worktree=repo+'/.worktrees/'+task,dir=worktree+'/tests/n88-actual-current-cause-20261020';
const cli='C:/Users/Abody/AppData/Local/npm-cache/_npx/d77349f55c2be1c0/node_modules/wrangler/wrangler-dist/cli.js',node='C:/Program Files/nodejs/node.exe';
const account='1c9ae85e766968a4269a7ac505f9a693',script='rakeez-n88-private-ingress';
const parser=dir+'/tail-parser.mjs',hash=x=>createHash('sha256').update(x).digest('hex');
export function failureCategory(line){
 if(/unknown (argument|option)|invalid (option|value)|not enough non-option/i.test(line))return'cli_arguments';
 if(/requires at least Node|unsupported node|engine.*node/i.test(line))return'node_runtime';
 if(/Cannot find module|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/.test(line))return'cli_dependency';
 if(/not logged in|authentication error|unauthori[sz]ed|authentication required|must.{0,20}login|run.{0,20}wrangler login|invalid.{0,15}(token|credential)/i.test(line))return'authentication_unavailable';
 if(/multiple accounts|no account.{0,12}(found|id)|CLOUDFLARE_ACCOUNT_ID/i.test(line))return'account_selection';
 if(/\b(?:EACCES|EPERM)\b/.test(line))return'local_access';
 if(/\b(?:ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ERR_TLS_CERT_ALTNAME_INVALID|CERT_HAS_EXPIRED)\b/.test(line))return'network_or_tls';
 if(/\[code: (10000|10012|10007|9109)\]/.test(line))return'provider_error';
 return null;
}
if(process.argv.includes('--self-test')){
 for(const [input,expected]of[['Unknown argument: PRIVATE_TOKEN','cli_arguments'],['Wrangler requires at least Node.js v22','node_runtime'],['Authentication error PRIVATE_TOKEN','authentication_unavailable'],['CLOUDFLARE_ACCOUNT_ID must be selected PRIVATE_EMAIL','account_selection'],['Cannot find module PRIVATE_PATH','cli_dependency'],['ETIMEDOUT PRIVATE_URL','network_or_tls'],['Authorization: PRIVATE_TOKEN',null],['Cookie: PRIVATE_PIN',null],['PRIVATE_NAME PRIVATE_BODY [code: 123456]',null]]){
  const output=failureCategory(input);assert.equal(output,expected);assert(!JSON.stringify(output).includes('PRIVATE_'));
 }
 console.log(JSON.stringify({opsObserverClassifier:'PASS',privateCanariesReflected:false,networkCalls:0}));
}else if(process.argv.includes('--observe')){
 const run=process.argv[process.argv.indexOf('--run-id')+1],expectedParserHash='580de98c2fc96b3adb7a361afd2157993baee8903d561328196c00dfcad3afdf';
 const q=JSON.parse(fs.readFileSync(repo+'/artifacts/ops-supervisor-v4/queue/'+task+'.json','utf8'));
 assert(q.status==='running'&&q.attempt?.runId===run&&q.sessionId==='01a14fc3-b292-7390-9952-8549a286c80f','original active task required');
 assert.equal(hash(fs.readFileSync(parser)),expectedParserHash,'reviewed parser changed');
 assert(fs.existsSync(node)&&fs.existsSync(cli),'existing supported runtime required');
 const {parsePretty,readyLine,expectedVersion}=await import(pathToFileURL(parser).href);
 const report={observerReady:false,matchedListEvents:0,cleanupCompleted:false,connectionsAttempted:1,accountBound:true,loggerPersistenceDisabled:true,format:'pretty',startupCategory:null,exitCode:null,exitSignal:null,stdoutSeen:false,stderrSeen:false,events:[]};
 const buffers={stdout:'',stderr:''};let stopping=false,timer,killer;
 const child=spawn(node,['--no-warnings',cli,'tail',script,'--format','pretty','--method','POST','--version-id',expectedVersion],{cwd:worktree,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,CI:'true',CLOUDFLARE_ACCOUNT_ID:account,WRANGLER_WRITE_LOGS:'false',WRANGLER_LOG_SANITIZE:'true',WRANGLER_SEND_METRICS:'false',NO_COLOR:'1',FORCE_COLOR:'0',TZ:'UTC'}});
 const stop=()=>{if(stopping)return;stopping=true;if(child.exitCode===null){child.kill('SIGINT');killer=setTimeout(()=>{if(child.exitCode===null)child.kill('SIGKILL');},2000);}};
 const consume=(stream,chunk)=>{report[stream+'Seen']=true;buffers[stream]+=chunk.toString();chunk.fill(0);if(buffers[stream].length>65536){buffers[stream]='';return;}let at;while((at=buffers[stream].indexOf('\n'))>=0){let line=buffers[stream].slice(0,at).replace(/\u001b\[[0-9;]*m/g,'').trim();buffers[stream]=buffers[stream].slice(at+1);const category=failureCategory(line);if(category&&!report.startupCategory)report.startupCategory=category;if(readyLine(line)){report.observerReady=true;console.log(JSON.stringify({observerReady:true}));}else if(report.observerReady){const event=parsePretty(line);if(event){report.events.push(event);report.matchedListEvents++;stop();}}line='';}};
 child.stdout.on('data',c=>consume('stdout',c));child.stderr.on('data',c=>consume('stderr',c));
 child.once('error',e=>{report.startupCategory=['ENOENT','EACCES','EPERM'].includes(e.code)?'local_process':'process_unavailable';stop();});
 timer=setTimeout(stop,60000);
 try{await new Promise(resolve=>child.once('close',(code,signal)=>{report.exitCode=Number.isInteger(code)?code:null;report.exitSignal=['SIGINT','SIGTERM','SIGKILL'].includes(signal)?signal:null;resolve();}));}
 finally{clearTimeout(timer);clearTimeout(killer);buffers.stdout='';buffers.stderr='';child.stdout.removeAllListeners('data');child.stderr.removeAllListeners('data');report.cleanupCompleted=true;if(!report.observerReady&&!report.startupCategory)report.startupCategory='unclassified_before_ready';fs.writeFileSync(dir+'/controlled-tail-repaired.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
}else{
 console.log('Use --self-test offline, or original active custodian --observe --run-id RUN --parser-sha256 SHA.');
}
