// AI: inactive existing Supabase Edge WebRequest entry. No live job registered.
import '../../../drafts/n44-push/node-globals.mjs';
import {createExistingHost} from '../../../drafts/n44-push/existing-host.mjs';
import {privateResponse} from '../../../drafts/n44-push/web-protocol.mjs';
import {readinessEntry} from '../../../drafts/n44-push/readiness-entry.mjs';
let runtime: ReturnType<typeof createExistingHost> | undefined;
Deno.serve(async (request: Request) => {
 if(new URL(request.url).pathname==='/functions/v1/n44-notifications/readiness')return readinessEntry(request,(name: string)=>Deno.env.get(name));
 try {runtime ??= createExistingHost((name: string) => Deno.env.get(name));return await runtime.handle(request);}
 catch{return privateResponse();}
});
addEventListener('beforeunload',()=>{void runtime?.close();});
