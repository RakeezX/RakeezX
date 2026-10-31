/** AI: mounted original numeric entry and actual HTTP client with trusted fixture readiness. */
import {createUnifiedStudentPortalClient} from '/src/lib/student-portal-unified-client.js';
import {mountUnifiedStudentPortal} from '/src/views/student-portal-login.js';
window.studentClient=createUnifiedStudentPortalClient({publicationReadiness:{enabled:true,serviceRevision:'n88-item-publication-v2'},timeoutMs:1500});
window.studentView=mountUnifiedStudentPortal(document.querySelector('#student'),{client:window.studentClient,readiness:{enabled:true}});
