/** Fixed operator-only facts. Never accepts errors, messages, addresses or IDs. */
const booleans=['material','permit','decrypt','dns','tls','requestWritten','providerAccepted','reservationCommit','jobMatch','commitAck'];
export function createAttemptTrace(){const facts=Object.fromEntries(booleans.map(k=>[k,false]));facts.providerStatusClass='none';return{record(key,value){if(booleans.includes(key)&&typeof value==='boolean')facts[key]=value;else if(key==='providerStatusClass'&&['none','2xx','3xx','4xx','5xx'].includes(value))facts[key]=value;},snapshot:()=>Object.freeze({...facts})};}
