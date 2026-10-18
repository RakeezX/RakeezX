/** AI: actual app synthetic review; no hosted operations. */
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {startIntegratedReview} from './integrated-review.mjs';
import {processIdentity} from '../../tests/fixtures/n88-current-review/native-pg.mjs';
export const root=fileURLToPath(new URL('../../',import.meta.url));
const fixture=path.join(root,'tests/fixtures/n88-integrated-class');
export function ttlSeconds(value=14400){const n=Number(value);if(!Number.isInteger(n)||n<1||n>28800)throw Error('TTL must be 1..28800 seconds');return n;}
export const startReview=({ttl=14400}={})=>startIntegratedReview({ttl:ttlSeconds(ttl)});
export const help='N88 current synthetic review (Windows, installed native PG17.6).\nnode drafts/n88-student-portal/current-review.mjs --receipt <local receipt.json> [--ttl-seconds 14400]\nTTL: 1..28800 seconds; default 4 hours, maximum 8.\nUse current-review-launch.ps1 to launch hidden, read the teacher URL, or request owned graceful shutdown. No hosted service is enabled.';
async function main() {
  const args=process.argv.slice(2);if(args.includes('--help')){console.log(help);return;}
  const options={};for(let i=0;i<args.length;i+=2){if(!['--receipt','--ttl-seconds'].includes(args[i])||!args[i+1]||options[args[i]])throw Error('Invalid arguments');options[args[i]]=args[i+1];}
  const ttl=ttlSeconds(options['--ttl-seconds']),receipt=path.resolve(options['--receipt']||'');
  if(!receipt.startsWith(path.join(fixture,'receipts')+path.sep)||path.extname(receipt)!=='.json')throw Error('Receipt must be a fresh JSON file in tests/fixtures/n88-integrated-class/receipts');
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
