/** AI: exact SCRAM SERVER-FIRST capture; no password or client-final proof can be sent. */
import {randomBytes} from 'node:crypto';
export async function serverFirst(Client,config){
 let accept,reject,timer,client,proofSent=false;
 const result=new Promise((ok,bad)=>{accept=ok;reject=bad;});
 const stop=code=>reject(Object.assign(Error(code),{code}));
 class ChallengeClient extends Client{
  _handleAuthCleartextPassword(){stop('N44_UNEXPECTED_CLEARTEXT');}
  _handleAuthMD5Password(){stop('N44_UNEXPECTED_MD5');}
  _handleAuthSASL(msg){
   if(!msg.mechanisms.includes('SCRAM-SHA-256'))return stop('N44_UNEXPECTED_MECHANISM');
   const stream=this.connection.stream;
   if(!stream.authorized||stream.servername!==config.host)return stop('N44_TLS_NOT_VERIFIED');
   this.n44Nonce=randomBytes(18).toString('base64');
   this.connection.sendSASLInitialResponseMessage('SCRAM-SHA-256','n,,n=*,r='+this.n44Nonce);
  }
  _handleAuthSASLContinue(msg){
   const m=/^r=([!-+\--~]+),s=([A-Za-z0-9+/]+={0,2}),i=([1-9][0-9]*)$/.exec(msg.data??'');
   if(!m||!m[1].startsWith(this.n44Nonce)||m[1].length<=this.n44Nonce.length)return stop('N44_INVALID_SERVER_FIRST');
   accept({salt:m[2],iterations:m[3],strictTLS:this.connection.stream.authorized===true,hostnameVerified:this.connection.stream.servername===config.host,proofSent});
  }
  _handleAuthSASLFinal(){stop('N44_UNEXPECTED_SERVER_FINAL');}
  _handleReadyForQuery(){stop('N44_UNEXPECTED_AUTH_SUCCESS');}
 }
 try{
  client=new ChallengeClient({...config,password:()=>{throw Error('N44_PASSWORD_FORBIDDEN');}});
  // Defense in depth: prevent every credential/final-proof send, even if pg changes dispatch.
  client.connection.password=()=>stop('N44_PASSWORD_FORBIDDEN');
  client.connection.sendSCRAMClientFinalMessage=()=>{proofSent=true;stop('N44_PROOF_FORBIDDEN');};
  client.on('error',e=>reject(e));
  void client.connect().then(()=>stop('N44_UNEXPECTED_AUTH_SUCCESS'),reject);
  timer=setTimeout(()=>stop('N44_CHALLENGE_TIMEOUT'),7000);
  return await result;
 }finally{clearTimeout(timer);if(client){const ended=client.end().catch(()=>{});client.connection.stream.destroy();await ended;}}
}
