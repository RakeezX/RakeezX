/** AI: inactive /s/:private-entry document. No account boot, SW, storage or analytics. */
import { createUnifiedStudentPortalClient } from '/src/lib/student-portal-unified-client.js';
import { mountUnifiedStudentPortal } from '/src/views/student-portal-login.js';
const readiness=Object.freeze({enabled:false});
mountUnifiedStudentPortal(document.getElementById('student-portal'),{client:createUnifiedStudentPortalClient(),readiness});
