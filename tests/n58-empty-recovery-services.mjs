// AI: official pinned local services. No Auth or Product SQL-to-HTTP substitute.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, createHash, createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const exec = promisify(execFile);
const { default: pg } = await import(pathToFileURL('C:/Users/Abody/Projects/RakeezX/artifacts/n77-native-pg17/client/node_modules/pg/lib/index.js'));
export const hash = value => createHash('sha256').update(value).digest('hex');
export const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer(); server.on('error', reject);
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
});
const images = {
  postgres: 'postgres@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94',
  auth: 'supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b',
  rest: 'postgrest/postgrest@sha256:d155c6718ed9a9f990d159a2ab7c0a3f16944dbb6d0a0344557421042acfe0df',
  mail: 'axllent/mailpit@sha256:6abc8e633df15eaf785cfcf38bae48e66f64beecdc03121e249d0f9ec15f0707',
};
const token = secret => {
  const head = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
  const body = Buffer.from(JSON.stringify({ role: 'anon', aud: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url');
  return head+'.'+body+'.'+createHmac('sha256',secret).update(head+'.'+body).digest('base64url');
};
const docker = async (args, env = {}) => (await exec('docker', args, { windowsHide: true, env: { ...process.env, ...env }, timeout: 90000, maxBuffer: 1024*1024 })).stdout.trim();
async function health(url, name) {
  const deadline = Date.now()+60000;
  while (Date.now()<deadline) {
    try { const r=await fetch(url,{signal:AbortSignal.timeout(1000)}); if(r.ok) return r; } catch {}
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw Error(name+'_HEALTH_TIMEOUT');
}
export async function withOfficialServices({ runId, appOrigin, deadlineAt=Date.now()+10*60*1000 }, work) {
  assert.match(runId,/^[a-f0-9-]{36}$/); assert.equal(new URL(appOrigin).hostname,'127.0.0.1');
  const prefix='n58-'+runId.replaceAll('-',''), label='rakeez.n58.run='+runId;
  const network=prefix+'-net',volume=prefix+'-pgdata', containers=[], migrations={}, identities={images,versions:{postgres:'17.6',auth:'v2.197.0',rest:'v16.4',mail:'v1.27.8'}};
  const secret=randomBytes(48).toString('base64url'), password=randomBytes(32).toString('base64url');
  const ports={pg:await freePort(),auth:await freePort(),rest:await freePort(),admin:await freePort()};
  let client, networkOwned=false,volumeOwned=false; const cleanup=[];
  const run=async(role,env={},extra=[])=>{
    assert.ok(Date.now()<deadlineAt,'LOCAL_PROTOCOL_DEADLINE');
    const name=prefix+'-'+role;
    await docker(['run','-d','--name',name,'--label',label,'--network',network,'--network-alias',role,
      ...Object.keys(env).flatMap(key=>['-e',key]),...extra,images[role]],env);
    containers.push(name);return name;
  };
  const owned=async(kind,name)=>{
    const labels=JSON.parse(await docker([kind,'inspect','--format','{{json .Labels}}',name]));
    assert.equal(labels?.['rakeez.n58.run'],runId,'Cleanup ownership mismatch');
  };
  try {
    for(const [role,image]of Object.entries(images)) identities[role]=JSON.parse(await docker(['image','inspect','--format','{{json .RepoDigests}}',image]));
    // Dedicated bridge; only explicit localhost ports are published. An
    // internal Docker bridge prevents this Windows host client reaching PG.
    // Service targets remain this network's PG/mail aliases, never hosted URLs.
    await docker(['network','create','--driver','bridge','--label',label,network]);networkOwned=true;
    await docker(['volume','create','--label',label,volume]);volumeOwned=true;
    await run('postgres',{POSTGRES_PASSWORD:password},['-p',`127.0.0.1:${ports.pg}:5432`,'-v',volume+':/var/lib/postgresql/data']);
    const deadline=Date.now()+30000;let connectionError;
    while(Date.now()<deadline){try{client=new pg.Client({host:'127.0.0.1',port:ports.pg,user:'postgres',password,database:'postgres',connectionTimeoutMillis:1000,query_timeout:30000,statement_timeout:30000});await client.connect();break;}catch(error){connectionError={code:error.code,message:error.message};await client?.end();client=null;await new Promise(r=>setTimeout(r,200));}}
    assert.ok(client,'Owned PostgreSQL startup timeout: '+JSON.stringify(connectionError));
    await client.query(`create schema auth;create schema realtime;create role authenticated;create role anon;create role service_role;
      create role authenticator login noinherit password '${password}';grant authenticated,anon to authenticator;
      create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
      grant usage on schema auth to authenticated,anon;
      create table realtime.messages(extension text,topic text);alter table realtime.messages enable row level security;
      create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
      create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$select$$;`);
    await run('mail',{MP_SMTP_AUTH_ACCEPT_ANY:'true',MP_SMTP_AUTH_ALLOW_INSECURE:'true'});
    await run('auth',{
      GOTRUE_API_HOST:'0.0.0.0',PORT:'9999',GOTRUE_API_PORT:'9999',API_EXTERNAL_URL:appOrigin+'/auth/v1',GOTRUE_SITE_URL:appOrigin,
      GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:`postgres://postgres:${password}@postgres:5432/postgres?search_path=auth`,GOTRUE_DB_NAMESPACE:'auth',
      GOTRUE_JWT_SECRET:secret,GOTRUE_JWT_EXP:'3600',GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_ADMIN_ROLES:'service_role',
      GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_DISABLE_SIGNUP:'false',GOTRUE_MAILER_AUTOCONFIRM:'true',
      GOTRUE_SMTP_HOST:'mail',GOTRUE_SMTP_PORT:'1025',GOTRUE_SMTP_ADMIN_EMAIL:'local@example.invalid',GOTRUE_LOG_LEVEL:'error',
      GOTRUE_RATE_LIMIT_EMAIL_SENT:'1000',GOTRUE_RATE_LIMIT_TOKEN_REFRESH:'1000',
    },['-p',`127.0.0.1:${ports.auth}:9999`]);
    const authUrl='http://127.0.0.1:'+ports.auth,restUrl='http://127.0.0.1:'+ports.rest;
    identities.authHealth=await(await health(authUrl+'/health','OFFICIAL_AUTH')).json();
    // Source definitions only in this disposable database. GoTrue owns auth.users.
    const savedRef='2a5242099dd73e161e1dffe1decc07f9d7653f6e'; const saved=['20261004070000_n58_calendar_persistence.sql','20261004070001_n58_extra_term_compatibility.sql','20261004070002_n58_effective_scope_revalidation.sql'];
    for(const file of [...new Set([...(await fs.readdir('supabase/migrations')), ...saved])].sort().filter(x=>/^\d+.*\.sql$/.test(x))){
      assert.ok(Date.now()<deadlineAt,'LOCAL_PROTOCOL_DEADLINE');
      const sql=(saved.includes(file) ? (await exec('git',['show',savedRef+':supabase/migrations/'+file],{windowsHide:true})).stdout : await fs.readFile('supabase/migrations/'+file,'utf8')).replace(/^\uFEFF/,'').replaceAll('\r\n','\n');
      if(file==='20261014090000_n100_automatic_safe_copy.sql'){
        const text=await fs.readFile('tests/n100-automatic-provider-source.json','utf8');migrations.n100Baseline=hash(text);
        for(const row of JSON.parse(text)){await client.query(row.definition);assert.equal((await client.query('select md5(prosrc) h from pg_proc where oid=$1::regprocedure',[row.signature])).rows[0].h,row.body_md5);}
      }
      migrations[file]=hash(sql);await client.query(sql);
    }
    await client.query('notify pgrst, \'reload schema\'');
    await run('rest',{PGRST_DB_URI:`postgres://authenticator:${password}@postgres:5432/postgres`,PGRST_DB_SCHEMAS:'rakeezx',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret,
      PGRST_SERVER_HOST:'0.0.0.0',PGRST_SERVER_PORT:'3000',PGRST_ADMIN_SERVER_PORT:'3001',PGRST_LOG_LEVEL:'error'},['-p',`127.0.0.1:${ports.rest}:3000`,'-p',`127.0.0.1:${ports.admin}:3001`]);
    await health('http://127.0.0.1:'+ports.admin+'/ready','OFFICIAL_POSTGREST');
    identities.postgresVersion=(await client.query('select version()')).rows[0].version;
    identities.protocolFunctions=(await client.query(`select p.oid::regprocedure::text signature,md5(p.prosrc) body_md5
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='rakeezx' and p.proname in
      ('n58_guard_calendar_contract','apply_sync_v2_mutation','provision_account_workspace','get_unified_restore_manifest','get_sync_v2_restore_manifest_full')
      order by signature`)).rows;
    identities.restVersion=await docker(['exec',prefix+'-rest','postgrest','--version']);
    // PostgreSQL is used for schema setup only; protocol scenario receives no SQL API.
    await client.end();client=null;
    return await work({authUrl,restUrl,anonKey:token(secret),identities,migrations,ports});
  } finally {
    await client?.end().catch(()=>{});
    for(const name of containers.reverse())try{
      const labels=JSON.parse(await docker(['inspect','--format','{{json .Config.Labels}}',name]));assert.equal(labels?.['rakeez.n58.run'],runId);
      await docker(['rm','-f',name]);cleanup.push({kind:'container',name,closed:true});
    }catch(error){cleanup.push({kind:'container',name,closed:false,error:error.message});}
    if(volumeOwned)try{await owned('volume',volume);await docker(['volume','rm',volume]);cleanup.push({kind:'volume',name:volume,closed:true});}catch(error){cleanup.push({kind:'volume',name:volume,closed:false,error:error.message});}
    if(networkOwned)try{await owned('network',network);await docker(['network','rm',network]);cleanup.push({kind:'network',name:network,closed:true});}catch(error){cleanup.push({kind:'network',name:network,closed:false,error:error.message});}
    await fs.writeFile('tests/n58-empty-recovery-cleanup-'+runId.slice(0,8)+'.json',JSON.stringify({runId,cleanup},null,2)+'\n');
    assert.ok(cleanup.every(x=>x.closed),'OWNED_RESOURCE_CLEANUP_FAILED');
  }
}
