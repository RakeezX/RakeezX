// AI: fixture composition loads actual unimported source modules, never lookalike markup.
import { createStudentPortalClient } from '/src/lib/student-portal-client.js';
import { mountStudentPortal } from '/src/views/student-portal.js';
import { mountTeacherInvitations } from '/drafts/n88-student-portal/teacher-controller.js';
const root = document.getElementById('pilot');
if (location.pathname === '/teacher') {
  const client = createStudentPortalClient({ fetch: (url, options) => fetch(url, { ...options,
    headers: { ...options.headers, 'X-Fixture-Teacher': 'fabricated-teacher-a' } }) });
  window.pilot = await mountTeacherInvitations(root, { client,
    copy: async text => { window.fabricatedCopy = text; }, print: () => { window.fabricatedPrint = true; } });
} else {
  const namespace = /^\/s\/([A-Za-z0-9_-]{43})$/.exec(location.pathname)?.[1];
  window.pilot = mountStudentPortal(root, { client: createStudentPortalClient({ base: '/api/n88/s/' + namespace, fetch: window.fetch.bind(window) }) });
}
