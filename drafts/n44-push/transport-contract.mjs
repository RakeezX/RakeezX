/** Pure fixed NON-PUSH protocol, also used by original Node custody. */
export const TRANSPORT_PURPOSE='n44-transport-v1',TRANSPORT_PROJECT='xlrubcwjqktzzunrvuns',TRANSPORT_HOST='fcm.googleapis.com';
export const NATIVE_PURPOSE='n44-native-head-v1',NATIVE_MODE='native-head-v1';
const nativeFlags=['materialReady','pairValid','senderConstructed','unsafeDiagnostics','dnsPublic','pinMatch','tlsVerified','requestWritten','closed','noRetry'];
const nativeFields=[...nativeFlags,'status','runtime','serviceRegion','family','headClass','phase','reason'].sort();
export function validateNativeResult(v){
 if(!v||Object.keys(v).sort().join(',')!==nativeFields.join(',')||nativeFlags.some(k=>typeof v[k]!=='boolean')||!['ready','unavailable'].includes(v.status)||!/^\d{1,3}(?:\.\d{1,3}){0,3}$/.test(v.runtime)||!['ap-south-1','other','unknown'].includes(v.serviceRegion)||!['none','4','6'].includes(v.family)||!['none','2xx','3xx','4xx','5xx'].includes(v.headClass)||!['material','dns','tls','write','headers','closed'].includes(v.phase)||!['none','unclassified','unsupported','deadline','trust','pin','network','dns'].includes(v.reason)||!v.noRetry)throw Error('n44_native_result_shape');
 if(v.status==='ready'&&(!nativeFlags.filter(k=>!['unsafeDiagnostics'].includes(k)).every(k=>v[k])||v.unsafeDiagnostics||v.headClass==='none'||v.reason!=='none'||v.phase!=='closed'))throw Error('n44_native_false_ready');return v;
}
const flags=['materialReady','pairValid','senderConstructed','unsafeDiagnostics','dnsPublic','pinMatch','nativeTlsVerified','nodeSocketSeen','nodeSecureConnectSeen','nodeCertRejected','closed','noRetry'];
const fields=[...flags,'status','runtime','family','headClass','phase','reason'].sort();
export function validateTransportResult(value){
 if(!value||Object.keys(value).sort().join(',')!==fields.join(',')||flags.some(k=>typeof value[k]!=='boolean')||!['ready','unavailable'].includes(value.status)||!/^\d{1,3}(?:\.\d{1,3}){0,3}$/.test(value.runtime)||!['none','4','6'].includes(value.family)||!['none','2xx','3xx','4xx','5xx'].includes(value.headClass)||!['material','dns','native_tls','node_head','closed'].includes(value.phase)||!['none','unclassified','unsupported','deadline','trust','pin','network','dns'].includes(value.reason)||!value.noRetry)throw Error('n44_transport_result_shape');
 if(value.status==='ready'&&(!value.closed||!['materialReady','pairValid','senderConstructed','dnsPublic','pinMatch','nativeTlsVerified','nodeSocketSeen','nodeSecureConnectSeen'].every(k=>value[k])||value.unsafeDiagnostics||value.nodeCertRejected||value.headClass==='none'||value.reason!=='none'||value.phase!=='closed'))throw Error('n44_transport_false_readiness');
 return value;
}
