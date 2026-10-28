/** One pinned HTTP/1.1 exchange after Deno's explicit default-trust handshake.
 * Only server-created request details reach this core. No DNS, redirect or retry.
 * Runtime/port injection belongs to owned synthetic fixtures, never request JSON. */
const encoder=new TextEncoder(),bad=reason=>Object.assign(Error('n44_native_transport'),{phaseReason:reason});
export async function nativeHttpExchange({hostname,pin,method,path,headers={},body=new Uint8Array(),signal,deadlineMs=9000},{runtime=globalThis.Deno,port=443}={}){
 const result={statusCode:null,pinMatch:false,tlsVerified:false,requestWritten:false,phase:'tls',reason:'unsupported',closed:false};
 let tcp,tls,pending=0;const cancel=new AbortController(),close=()=>{try{tls?.close();}catch{}try{tcp?.close();}catch{}};
 const stop=()=>{cancel.abort();close();};const timer=setTimeout(stop,Math.max(1,Math.min(10000,deadlineMs)));signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop();
 const wait=p=>new Promise((resolve,reject)=>{const abort=()=>reject(bad('deadline'));cancel.signal.addEventListener('abort',abort,{once:true});if(cancel.signal.aborted)abort();Promise.resolve(p).then(resolve,reject).finally(()=>cancel.signal.removeEventListener('abort',abort));});
 try{
  if(!runtime?.connect||!runtime?.startTls)throw bad('unsupported');
  if(cancel.signal.aborted)throw bad('deadline');
  if(!/^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/.test(hostname??'')||!pin||![4,6].includes(pin.family)||!['HEAD','POST'].includes(method)||!/^\/[\x21-\x7e]*$/.test(path??'')||path.startsWith('//')||!(body instanceof Uint8Array)||body.length>65536||(method==='HEAD'&&body.length))throw bad('unclassified');
  const lines=[];for(const [name,value]of Object.entries(headers)){if(!/^[A-Za-z0-9-]+$/.test(name)||['host','connection','content-length','transfer-encoding','expect','upgrade','trailer'].includes(name.toLowerCase())||typeof value!=='string'&&typeof value!=='number'||!/^[\x20-\x7e]*$/.test(String(value)))throw bad('unclassified');lines.push(name+': '+value);}
  const framing=encoder.encode(`${method} ${path} HTTP/1.1\r\nHost: ${hostname}\r\nConnection: close\r\n${lines.length?lines.join('\r\n')+'\r\n':''}${method==='POST'?'Content-Length: '+body.length+'\r\n':''}\r\n`);if(framing.length>8192)throw bad('unclassified');
  pending++;const connecting=runtime.connect({hostname:pin.address,port,transport:'tcp'}).then(c=>{tcp=c;if(cancel.signal.aborted){close();throw bad('deadline');}return c;}).finally(()=>pending--);await wait(connecting);
  if(tcp.remoteAddr?.hostname!==pin.address)throw bad('pin');result.pinMatch=true;
  pending++;const upgrading=runtime.startTls(tcp,{hostname,alpnProtocols:['http/1.1']}).then(c=>{tls=c;tcp=null;if(cancel.signal.aborted){close();throw bad('deadline');}return c;}).finally(()=>pending--);await wait(upgrading);
  if(typeof tls.handshake!=='function')throw bad('unsupported');await wait(tls.handshake());if(cancel.signal.aborted)throw bad('deadline');result.tlsVerified=true;
  result.phase='write';for(const bytes of [framing,body]){let offset=0;while(offset<bytes.length){if(cancel.signal.aborted)throw bad('deadline');const n=await wait(tls.write(bytes.subarray(offset)));if(!Number.isInteger(n)||n<1||n>bytes.length-offset)throw bad('network');offset+=n;}}
  result.requestWritten=true;result.phase='headers';let text='',total=0,interim=0;const buffer=new Uint8Array(1024);
  while(true){const n=await wait(tls.read(buffer));if(n===null)throw bad('network');if(!Number.isInteger(n)||n<1||n>buffer.length)throw bad('network');total+=n;if(total>8192)throw bad('unclassified');for(let i=0;i<n;i++)text+=String.fromCharCode(buffer[i]);
   let end;while((end=text.indexOf('\r\n\r\n'))>=0){
    const block=text.slice(0,end);text=text.slice(end+4);const rows=block.split('\r\n'),match=/^HTTP\/1\.[01] ([1-5][0-9]{2})(?: [\x20-\x7e]*)?$/.exec(rows.shift());if(!match)throw bad('unclassified');
    const seen=new Set();for(const row of rows){const h=/^([!#$%&'*+.^_`|~0-9A-Za-z-]+):([\t\x20-\x7e]*)$/.exec(row);if(!h)throw bad('unclassified');const key=h[1].toLowerCase(),value=h[2].trim();if(['content-length','transfer-encoding'].includes(key)&&seen.has(key))throw bad('unclassified');if(key==='content-length'&&(!/^\d{1,15}$/.test(value)||!Number.isSafeInteger(Number(value))))throw bad('unclassified');if(key==='transfer-encoding'&&value.toLowerCase()!=='chunked')throw bad('unclassified');seen.add(key);}
    if(seen.has('content-length')&&seen.has('transfer-encoding'))throw bad('unclassified');const code=Number(match[1]);if(code<200){if(code===101||++interim>4)throw bad('unclassified');continue;}
    if(cancel.signal.aborted)throw bad('deadline');result.statusCode=code;result.phase='closed';result.reason='none';return result;
   }
  }
 }catch(e){result.reason=cancel.signal.aborted?'deadline':e.phaseReason??(['InvalidData','BadResource'].includes(e.name)?'trust':'network');return result;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);close();result.closed=pending===0;}
}
