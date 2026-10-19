/** AI: one fixed changed-source diagnostic, no sender or registration capability. */
export const DIAGNOSTIC_SOURCE='0bc9e6f37bd37dc00f2d2237bd0215034b6751b2facfa58f4b8ce734f545d77c';
export function assertDiagnosticAttempt({source,consumed,cleaned,targetBound,sends}){
 if(source!==DIAGNOSTIC_SOURCE||consumed!==false||cleaned!==true||targetBound!==false||sends!==0)throw Error('n44_diagnostic_attempt_denied');
}
