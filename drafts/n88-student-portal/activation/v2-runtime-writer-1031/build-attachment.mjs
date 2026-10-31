/** AI: deterministic inactive source generation from the bounded actual inventory. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const dir=new URL('.',import.meta.url),read=n=>fs.readFileSync(new URL(n,dir),'utf8'),write=(n,s)=>fs.writeFileSync(new URL(n,dir),s);
const sha=s=>createHash('sha256').update(s).digest('hex'),m=JSON.parse(read('current-writers.json'));
const entries=m.functions.filter(f=>!f.proname.includes('_before'));
const locks=['years','terms','sections','students','enrollments','teachings','items','scores','score_subitems','score_subitem_completions','sessions','attendance','logs','subjects','slots','session_roster_snapshots'];
const retired=['items','score_subitems','teachings','sections','terms','years','subjects'];
let sql='-- AI: original complete CURRENT bodies nested intact, same OIDs/security/ACLs, never replaced by an older core.\n';
const identities=[];
for(const f of entries){
 if(f.owner!=='postgres'||f.result!=='jsonb'||f.acl!=='{postgres=X/postgres,authenticated=X/postgres}')throw Error('unreviewed_entry_metadata:'+f.proname);
 const header=f.definition.slice(0,f.definition.indexOf('\nAS $function$')),original=f.definition.split('AS $function$')[1].split('$function$')[0];
 if(!header||!f.proargnames?.every(n=>/^[a-z_0-9]+$/.test(n)))throw Error('entry_shape');
 if(original.includes('__n88_entry_lock_1031_8c4d'))throw Error('entry_local_collision');
 // A declaration expression acquires the lock without changing the original
 // function's initial FOUND/ROW_COUNT (a PERFORM statement would change them).
 const body=' DECLARE __n88_entry_lock_1031_8c4d text := pg_catalog.pg_advisory_xact_lock(1312307256,88)::text; BEGIN\n'+original+(original.trimEnd().endsWith(';')?'':';')+'\nEND; ';
 // Escape source line endings inside an SQL E string so Git/package LF handling
 // cannot rewrite the observed original CRLF function bodies.
 const literal=body.replaceAll('\\','\\\\').replaceAll("'","''").replaceAll('\r','\\r').replaceAll('\n','\\n');
 sql+=header+"\nAS E'"+literal+"';\n";
 identities.push({name:f.proname,signature:f.signature,baselineSha256:f.sha256,bodySha256:sha(original),wrapperBodySha256:sha(body),owner:f.owner,acl:f.acl,arguments:f.arguments,config:f.proconfig,definer:f.prosecdef,strict:f.proisstrict,volatility:f.provolatile,parallel:f.proparallel,style:'outer PLpgSQL block; original complete body nested byte-identically; no new backing entry',reason:'original student-lifecycle/admission/source locks or nested projection writes; early global ordering'});
}
for(const t of locks)sql+=`CREATE TRIGGER "00_n88_global_1031" BEFORE INSERT OR UPDATE OR DELETE ON rakeezx.${t} FOR EACH STATEMENT EXECUTE FUNCTION n88_private.v2_writer_lock_1031();\n`;
for(const t of retired)sql+=`CREATE TRIGGER "zz_n88_retire_1031" AFTER UPDATE OR DELETE ON rakeezx.${t} FOR EACH ROW EXECUTE FUNCTION n88_private.v2_writer_after_1031();\n`;
write('writer-replacement.sql',sql);
write('writer-baseline.json',JSON.stringify({version:2,actualInventorySha256:sha(read('current-writers.json')),entries:identities,unchangedBackingChains:m.functions.filter(f=>f.proname.includes('_before')).map(f=>({signature:f.signature,sha256:f.sha256})),statementTables:locks,retirementTables:retired,canonicalWritesByN88:0,canonicalPoliciesAdded:0,newBackingEntries:0},null,2)+'\n');
write('expected-identities.json',JSON.stringify({version:2,sourceOfTruth:'writer-baseline.json + post.sql',entries:identities,helpers:['v2_writer_lock_1031()','v2_writer_after_1031()','v2_writer_retire_1031(uuid,text,text,text,bigint)'],supersedes:'historical replacement proof0b17ef97'},null,2)+'\n');
const baseline=m.functions.map(f=>({signature:f.signature,sha256:f.sha256,owner:f.owner,acl:f.acl}));
let gate=read('gate.template.sql');const start=gate.indexOf(' IF encode(sha256('),end=gate.indexOf(' IF EXISTS(select 1 from pg_proc',start);
gate=gate.slice(0,start)+` IF EXISTS(select 1 from jsonb_to_recordset('${JSON.stringify(baseline).replaceAll("'","''")}'::jsonb) e(signature text,sha256 text,owner text,acl text) left join pg_proc p on p.oid=to_regprocedure(e.signature) where p.oid is null or encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')<>e.sha256 or pg_get_userbyid(p.proowner)<>e.owner or p.proacl::text<>e.acl) THEN RAISE EXCEPTION 'n88_actual_current_writer_changed';END IF;\n`+gate.slice(end);
// Collision checks include private preserved bodies and installed trigger names.
gate=gate.replace("proname like 'v2_writer_%' or proname='v2_runtime_identity_1031'","proname like 'v2_writer_%' or proname like 'writer_1031_%' or proname='v2_runtime_identity_1031'");
gate=gate.replace('END $gate$;',` IF EXISTS(select 1 from pg_trigger where tgname in ('00_n88_global_1031','zz_n88_retire_1031')) THEN RAISE EXCEPTION 'n88_attachment_collision';END IF;\nEND $gate$;`);
const triggerPins=JSON.stringify(m.triggers.map(t=>({table:t.relname,name:t.tgname,definition:t.definition,function:t.function,sha256:sha(t.function_definition)}))).replaceAll("'","''");
const triggerGuard=` IF EXISTS(select 1 from jsonb_to_recordset('${triggerPins}'::jsonb) e("table" text,name text,definition text,"function" text,sha256 text) left join pg_trigger t on t.tgrelid=to_regclass('rakeezx.'||e."table") and t.tgname=e.name where t.oid is null or pg_get_triggerdef(t.oid,true)<>e.definition or t.tgfoid::regprocedure::text<>e."function" or encode(sha256(convert_to(pg_get_functiondef(t.tgfoid),'UTF8')),'hex')<>e.sha256) THEN RAISE EXCEPTION 'n88_original_trigger_preimage_changed';END IF;\n`;
gate=gate.replace('END $gate$;',triggerGuard+'END $gate$;');
write('gate.sql',gate);
const e=JSON.stringify(identities).replaceAll("'","''"),chains=JSON.stringify(m.functions.filter(f=>f.proname.includes('_before')).map(f=>({signature:f.signature,sha256:f.sha256}))).replaceAll("'","''");
write('post.sql',`DO $post$ BEGIN
${triggerGuard}
 IF EXISTS(select 1 from jsonb_to_recordset('${e}'::jsonb) e(signature text,"wrapperBodySha256" text,arguments text,config jsonb,definer boolean,strict boolean,volatility text,parallel text) left join pg_proc p on p.oid=to_regprocedure(e.signature) where p.oid is null or p.proowner<>'postgres'::regrole or p.prosecdef is distinct from e.definer or p.proisstrict is distinct from e.strict or p.provolatile::text<>e.volatility or p.proparallel::text<>e.parallel or p.proacl::text<>'{postgres=X/postgres,authenticated=X/postgres}' or to_jsonb(p.proconfig) is distinct from e.config or pg_get_function_arguments(p.oid)<>e.arguments or encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')<>e."wrapperBodySha256") THEN RAISE EXCEPTION 'n88_current_body_wrapper_metadata_mismatch';END IF;
 IF EXISTS(select 1 from jsonb_to_recordset('${chains}'::jsonb) e(signature text,sha256 text) left join pg_proc p on p.oid=to_regprocedure(e.signature) where p.oid is null or encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')<>e.sha256) THEN RAISE EXCEPTION 'n88_original_chain_changed';END IF;
 IF (select count(*) from pg_trigger where tgname='00_n88_global_1031' and not tgisinternal)<>${locks.length} OR (select count(*) from pg_trigger where tgname='zz_n88_retire_1031' and not tgisinternal)<>${retired.length} THEN RAISE EXCEPTION 'n88_trigger_attachment_mismatch';END IF;
 IF EXISTS(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.pronamespace='n88_private'::regnamespace and (p.proname like 'v2_writer_%' or p.proname like 'writer_1031_%') and (a.grantee<>p.proowner or a.is_grantable)) THEN RAISE EXCEPTION 'n88_private_backing_exposed';END IF;
 IF pg_has_role('n88_backend','n88_v2_guard','SET') OR pg_has_role('n88_backend','n88_guard','SET') OR pg_has_role('postgres','n88_v2_guard','SET') OR pg_has_role('postgres','n88_v2_guard','USAGE') THEN RAISE EXCEPTION 'n88_runtime_role_not_restricted';END IF;
 IF (select count(*) from pg_proc p where p.pronamespace='n88_private'::regnamespace and p.proname ~ '^v2_[a-f0-9]{24}$' and p.proowner='n88_v2_guard'::regrole and has_function_privilege('n88_backend',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE'))<>14 THEN RAISE EXCEPTION 'n88_runtime_execute';END IF;
 IF has_any_column_privilege('n88_backend','auth.users','SELECT') OR EXISTS(select 1 from pg_class c where c.relnamespace='n88_private'::regnamespace and c.relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts') and (has_any_column_privilege('n88_backend',c.oid,'SELECT,INSERT,UPDATE,REFERENCES') or has_table_privilege('n88_backend',c.oid,'DELETE,TRUNCATE,TRIGGER'))) THEN RAISE EXCEPTION 'n88_raw_privilege';END IF;
 IF (select count(*) from pg_class where relnamespace='n88_private'::regnamespace and relname in ('publication_v2_scopes','publication_v2_items','publication_v2_high_water','publication_v2_receipts') and relrowsecurity and relforcerowsecurity)<>4 OR has_schema_privilege('anon','n88_private','USAGE') OR has_schema_privilege('authenticated','n88_private','USAGE') THEN RAISE EXCEPTION 'n88_nonexposure';END IF;
END $post$;
COMMIT;
`);
console.log(JSON.stringify({entries:entries.length,originalChains:baseline.length-entries.length,lockTables:locks.length,afterTables:retired.length}));
