import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {normalizeCloudflareIndex as normalize} from './publisher.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(process.argv[2] || path.join(here,'../..'));
const publisher=await fs.readFile(path.join(here,'publisher.mjs'),'utf8');
const templateDecl=publisher.match(/const CF_JSD_TEMPLATE = `[^`]+`;/)[0];
const second=publisher.match(/const CF_JSD_20261030_TEMPLATE = `[^`]+`;/)[0];
const hash=b=>createHash('sha256').update(b).digest('hex');
const expected=Buffer.from('<html><head></head><body>OK</body></html>');
const meta={repoPath:'index.html',urlPath:'index.html',statusCode:200,server:'cloudflare',contentType:'text/html',expectedSha256:hash(expected)};
const accepted=body=>{const n=normalize(body,meta);return !!n&&n.normalizedSha256===meta.expectedSha256};
const text=expected.toString(); const raw=expected;
const tpl=second.slice(second.indexOf('`')+1,second.lastIndexOf('`'));
const oldTpl=templateDecl.slice(templateDecl.indexOf('`')+1,templateDecl.lastIndexOf('`'));
const timestamp=Buffer.from('1793356800').toString('base64'),ray='abcdef0123456789';
const render=t=>t.replaceAll('CF_RAY_VALUE_SECOND',ray).replaceAll('CF_RAY_VALUE',ray).replaceAll('CF_TIME_VALUE',timestamp);
const beacon=[...publisher.matchAll(/const CF_ANALYTICS_202610(?:14|17) = ("[^\n]+");/g)].map(m=>JSON.parse(m[1]));
assert.equal(beacon.length,2);
const inject=tag=>Buffer.from(expected.toString('latin1').replace('</body>',tag+'</body>'),'latin1');
let passed=0;
for(const jsd of [render(oldTpl),render(tpl)])for(const tail of [jsd,...beacon.flatMap(b=>[jsd+b,b+jsd,jsd+'\n'+b,b+'\n'+jsd])]){assert(accepted(inject(tail)));passed++;}
const tag=render(tpl);
const negatives=[
 ['ray mismatch',tag.replace('?ray='+ray,'?ray=0123456789abcdef')],
 ['timestamp nondigits',tag.replace(timestamp,Buffer.from('179335680x').toString('base64'))],
 ['timestamp short',tag.replace(timestamp,Buffer.from('179335680').toString('base64'))],
 ['timestamp junk',tag.replace(timestamp,timestamp+'!')],
 ['origin code modified',tag.replace('window.parent.location','window.location')],
 ['challenge path modified',tag.replace('/jsd/main.js','/jsd/other.js')],
 ['unapproved query',tag.replace('?ray=','?extra=1&ray=')],
 ['extra executable',tag.replace('</script>','alert(1);</script>')],
 ['duplicate injection',tag+tag],
 ['unknown script',tag+'<script>alert(1)</script>'],
 ['beacon modified',tag+beacon[1].replace('crossorigin="anonymous"','crossorigin="use-credentials"')],
];
for(const [name,bad]of negatives){assert(!accepted(inject(bad)),name);passed++;}
assert(!accepted(Buffer.from(text.replace('<head>','<head><meta name="unexpected" content="changed">'),'latin1')),'Application HTML mutation');passed++;
assert.equal(normalize(raw,{...meta,server:'other'}),null);passed++;
assert.equal(normalize(raw,{...meta,mitigated:'challenge'}),null);passed++;
const fixtureRoot=path.join(root,'artifacts/ops-supervisor-v4');
const fixture=await fs.readFile(path.join(fixtureRoot,'n145-provider-20261030.html'));
const facts=JSON.parse(await fs.readFile(path.join(fixtureRoot,'n145-provider-20261030.json'),'utf8'));
assert.equal(hash(fixture),facts.bodySha256);
assert.equal(facts.sriMatches,true);
assert.match(facts.publishedSha,/^[a-f0-9]{40}$/);
const gitIndex=execFileSync('git',['show',facts.publishedSha+':index.html'],{cwd:root,maxBuffer:8*1024*1024});
assert.equal(hash(gitIndex),facts.expectedSha256);
const result=normalize(fixture,{...meta,expectedSha256:facts.expectedSha256});
assert(result && result.normalizedSha256===facts.expectedSha256);
assert(result.providerTransforms.includes('cloudflare-jsd-20261030'));
console.log(JSON.stringify({status:'PASS',syntheticChecks:passed,actualFixtureChecks:1,fixtureSha256:hash(fixture),expectedSha256:facts.expectedSha256,publishedSha:facts.publishedSha,providerCalls:0,canonicalModified:false}));
