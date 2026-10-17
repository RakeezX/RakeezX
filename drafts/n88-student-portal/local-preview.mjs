/** AI: explicit opt-in fabricated loopback preview, never a production entry. */
import { startPilotServer } from '../../tests/fixtures/n88-real-pilot/server.mjs';
if (!process.argv.includes('--synthetic')) throw Error('Use --synthetic; no real account adapter exists.');
const server = await startPilotServer();
console.log(JSON.stringify({ fabricatedOnly: true, teacher: server.url + '/teacher', student: 'Generate the private student link through the fabricated teacher form; never log credentials.',
  ownedPid: server.pid, startedAt: server.startedAt, serverExpiresAt: server.expiresAt, pinPolicy: '1000..9999; 9000 values; no padding/leading zero', codeExpiry: 'no term reset; stable owner/student; current unambiguous membership required; teacher rotate/revoke' }));
let closing = false;
const close = async () => { if (closing) return; closing = true; await server.close(); };
process.once('SIGINT', close); process.once('SIGTERM', close);
