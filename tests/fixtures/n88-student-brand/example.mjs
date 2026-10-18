/** AI: loopback-only, already-signed-in visual example; never imported by /student runtime. */
import { mountUnifiedStudentPortal } from '/src/views/student-portal-login.js';
import { projection } from './projection.mjs';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) throw Error('Local synthetic example only');
let ended = false;
const unavailable = () => { throw Object.assign(new Error('Synthetic session unavailable'), { kind: 'session' }); };
const client = {
  async read() { if (ended) unavailable(); return structuredClone(projection); },
  async claim() { unavailable(); }, // No simulated login or credential.
  async end() { ended = true; }, invalidate() {}, dispose() {}
};
document.querySelector('#example-theme').onclick = () => {
  document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
};
window.portal = mountUnifiedStudentPortal(document.querySelector('#portal'), { client, readiness: { enabled: true } });
