/** AI: synthetic composition of the actual current numeric student page. */
import {createUnifiedStudentPortalClient} from '/src/lib/student-portal-unified-client.js';
import {mountUnifiedStudentPortal} from '/src/views/student-portal-login.js';
window.studentClient=createUnifiedStudentPortalClient({publicationReadiness:{enabled:true,serviceRevision:'n88-item-publication-v2'}});
window.studentView=mountUnifiedStudentPortal(document.querySelector('#student'),{client:window.studentClient,readiness:{enabled:true}});
