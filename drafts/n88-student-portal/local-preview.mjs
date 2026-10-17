/** AI: explicit opt-in fabricated loopback preview, never a production entry. */
import { startPilotServer } from '../../tests/fixtures/n88-real-pilot/server.mjs';
if (!process.argv.includes('--synthetic')) throw Error('Use --synthetic; no real account adapter exists.');
const server = await startPilotServer();
console.log(JSON.stringify({ fabricatedOnly: true, teacher: server.url + '/teacher', student: server.url + '/s/' + server.fixture.namespace,
  ownedPid: server.pid, startedAt: server.startedAt, serverExpiresAt: server.expiresAt, codeExpiry: 'none; rotate/revoke/membership only' }));
let closing = false;
const close = async () => { if (closing) return; closing = true; await server.close(); };
process.once('SIGINT', close); process.once('SIGTERM', close);
