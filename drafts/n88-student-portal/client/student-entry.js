/** AI: inactive universal /student document, six-v1. No account boot, SW, storage or analytics. */
import { createUnifiedStudentPortalClient } from '/src/lib/student-portal-unified-client.js';
import { mountUnifiedStudentPortal } from '/src/views/student-portal-login.js';
import { createBindingProofObserver } from './binding-proof.js';
const readiness=Object.freeze({enabled:true,mode:'pilot'});
const root=document.getElementById('student-portal');
const bindingProof=createBindingProofObserver({location:window.location,history:window.history,root});
mountUnifiedStudentPortal(root,{client:createUnifiedStudentPortalClient({bindingProof}),readiness});
