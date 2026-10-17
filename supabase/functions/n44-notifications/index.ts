// AI: inactive existing Supabase Edge WebRequest entry. No live job registered.
import '../../../drafts/n44-push/node-globals.mjs';
import {createExistingHost} from '../../../drafts/n44-push/existing-host.mjs';
import {privateResponse} from '../../../drafts/n44-push/web-protocol.mjs';
let runtime: ReturnType<typeof createExistingHost> | undefined;
Deno.serve(async (request: Request) => {
 try {runtime ??= createExistingHost((name: string) => Deno.env.get(name));return await runtime.handle(request);}
 catch{return privateResponse();}
});
addEventListener('beforeunload',()=>{void runtime?.close();});
