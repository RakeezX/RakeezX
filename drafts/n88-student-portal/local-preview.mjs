/** AI: explicit opt-in fabricated loopback preview, never a production entry. */
import { startPilotServer } from '../../tests/fixtures/n88-real-pilot/server.mjs';
if (!process.argv.includes('--synthetic')) throw Error('Use --synthetic; no real account adapter exists.');
const server = await startPilotServer();
console.log('Fabricated data only. Teacher: ' + server.url + '/teacher · Student: ' + server.url + '/student');
let closing = false;
const close = async () => { if (closing) return; closing = true; await server.close(); };
process.once('SIGINT', close); process.once('SIGTERM', close);
