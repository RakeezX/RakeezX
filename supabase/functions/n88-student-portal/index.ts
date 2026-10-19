// AI: deployable Edge entry, INACTIVE unless explicitly configured after readback.
import '../../../drafts/n88-student-portal/activation/node-globals.mjs';
import {createExistingHost} from '../../../drafts/n88-student-portal/existing-host.mjs';
import {privateResponse} from '../../../drafts/n88-student-portal/web-protocol.mjs';
import {readinessEntry} from '../../../drafts/n88-student-portal/activation/readiness-entry.mjs';
import {edgeRequest} from '../../../drafts/n88-student-portal/activation/edge-request.mjs';
import {createRolloutGuard} from '../../../drafts/n88-student-portal/rollout-guard.mjs';
let runtime: ReturnType<typeof createExistingHost> | undefined;
let runtimeGeneration: string | undefined;
Deno.serve(async (request: Request) => {
  try{request=edgeRequest(request,(name: string)=>Deno.env.get(name));}catch{return privateResponse();}
  try {
    if(new URL(request.url).pathname==='/functions/v1/n88-student-portal/readiness')return await readinessEntry(request,(name: string)=>Deno.env.get(name));
    const readEnv=(name: string)=>Deno.env.get(name);
    // Do not memoize a disabled host during provider boot/early probe requests.
    // Every request still closes immediately when trusted rollout config is OFF.
    if(readEnv('N88_ENABLED')!=='true'||!createRolloutGuard(readEnv).configured)return privateResponse();
    const generation=JSON.stringify([readEnv('N88_ROLLOUT_MODE'),readEnv('N88_PILOT_BINDING'),readEnv('N88_SERVICE_SOURCE_SHA')]);
    if(runtime&&generation!==runtimeGeneration){const old=runtime;runtime=undefined;void old.close().catch(()=>{});}
    runtime ??= createExistingHost((name: string) => Deno.env.get(name));
    runtimeGeneration=generation;
    return await runtime.handle(request);
  } catch { return privateResponse(); }
});
addEventListener('beforeunload', () => { void runtime?.close().catch(()=>{}); });
