// AI: deployable Edge entry, INACTIVE unless explicitly configured after readback.
import {createExistingHost} from '../../../drafts/n88-student-portal/existing-host.mjs';
import {privateResponse} from '../../../drafts/n88-student-portal/web-protocol.mjs';
let runtime: ReturnType<typeof createExistingHost> | undefined;
Deno.serve(async (request: Request) => {
  try {
    runtime ??= createExistingHost((name: string) => Deno.env.get(name));
    return await runtime.handle(request);
  } catch { return privateResponse(); }
});
addEventListener('beforeunload', () => { void runtime?.close(); });
