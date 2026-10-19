// AI: deployable Edge entry, INACTIVE unless explicitly configured after readback.
import '../../../drafts/n88-student-portal/activation/node-globals.mjs';
import {createExistingHost} from '../../../drafts/n88-student-portal/existing-host.mjs';
import {privateResponse} from '../../../drafts/n88-student-portal/web-protocol.mjs';
import {readinessEntry} from '../../../drafts/n88-student-portal/activation/readiness-entry.mjs';
import {edgeRequest} from '../../../drafts/n88-student-portal/activation/edge-request.mjs';
let runtime: ReturnType<typeof createExistingHost> | undefined;
Deno.serve(async (request: Request) => {
  try{request=edgeRequest(request,(name: string)=>Deno.env.get(name));}catch{return privateResponse();}
  try {
    if(new URL(request.url).pathname==='/functions/v1/n88-student-portal/readiness')return await readinessEntry(request,(name: string)=>Deno.env.get(name));
    runtime ??= createExistingHost((name: string) => Deno.env.get(name));
    return await runtime.handle(request);
  } catch { return privateResponse(); }
});
addEventListener('beforeunload', () => { void runtime?.close(); });
