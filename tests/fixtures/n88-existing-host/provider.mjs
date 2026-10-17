/** AI: fabricated signing keys/provider responses ONLY. Production uses official SDK. */
import {generateKeyPairSync,sign,verify,createHmac,timingSafeEqual} from 'node:crypto';
export const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const SESSION='11111111-1111-4111-8111-111111111111';
export const authUrl='https://auth.synthetic.invalid';
export function providerFixture() {
  const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),hmac=Buffer.alloc(32,7);
  const jwk={...publicKey.export({format:'jwk'}),kid:'fabricated-ec-key',alg:'ES256',use:'sig'};
  const fixture={foreign:false,banned:false,denied:false,calls:[],delay:false};
  fixture.token=(overrides={},alg='ES256')=>{
    const sec=Math.floor(Date.now()/1000);
    const header={alg,typ:'JWT',...(alg==='ES256'?{kid:jwk.kid}:{})};
    const payload={iss:authUrl+'/auth/v1',aud:'authenticated',role:'authenticated',sub:A,session_id:SESSION,exp:sec+3600,iat:sec-1,...overrides};
    const input=[header,payload].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
    const signature=alg==='ES256'?sign('sha256',Buffer.from(input),{key:privateKey,dsaEncoding:'ieee-p1363'}):createHmac('sha256',hmac).update(input).digest();
    return input+'.'+signature.toString('base64url');
  };
  fixture.fetch=async(url,init)=>{
    fixture.calls.push(new URL(url).pathname);
    if(fixture.delay)await new Promise((_,reject)=>{if(init.signal.aborted)reject(Error('synthetic_abort'));else init.signal.addEventListener('abort',()=>reject(Error('synthetic_abort')),{once:true});});
    if(url.endsWith('/.well-known/jwks.json'))return Response.json({keys:[jwk]});
    if(!url.endsWith('/user'))throw Error('unexpected_provider_path');
    const bearer=new Headers(init.headers).get('authorization')?.slice(7)||'';
    let valid=false;
    try {
      const [h,p,s]=bearer.split('.'),header=JSON.parse(Buffer.from(h,'base64url'));
      const input=h+'.'+p,signature=Buffer.from(s,'base64url');
      valid=header.alg==='ES256'?verify('sha256',Buffer.from(input),{key:publicKey,dsaEncoding:'ieee-p1363'},signature):
        header.alg==='HS256' && timingSafeEqual(createHmac('sha256',hmac).update(input).digest(),signature);
    }catch{}
    return !valid || fixture.denied?Response.json({message:'unavailable'},{status:401}):Response.json({id:fixture.foreign?B:A,
      ...(fixture.banned?{banned_until:'2999-01-01T00:00:00Z'}:{}),user_metadata:{owner_id:B,session_id:'untrusted'}});
  };
  return fixture;
}
