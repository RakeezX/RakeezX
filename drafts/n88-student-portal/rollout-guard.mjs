/** AI: additional rollout admission AFTER original Auth/session/source validation.
 * Private binding remains in closures. No identifiers, secrets or config are exposed.
 * This module alone is NOT operational enforcement; original service hooks are required.
 */
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v);
const id=v=>typeof v==='string'&&v.length>0&&v.length<=240&&!v.includes('\0');
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const off=()=>Object.freeze({mode:'off',configured:false,allowsOwner:()=>false,allowsMember:()=>false,admitsTeacher:()=>false,admitsStudent:()=>false});
export function createRolloutGuard(readEnv){
 if(typeof readEnv!=='function')return off();
 let mode,binding,proof;
 try{
  mode=readEnv('N88_ROLLOUT_MODE');
  if(mode==='off'||mode==null)return off();
  if(mode==='public'){
   proof=readEnv('N88_PUBLIC_HOSTED_ACCEPTANCE_SHA256');
   if(typeof proof!=='string'||!/^[a-f0-9]{64}$/.test(proof)||readEnv('N88_PUBLIC_HOSTED_ACCEPTANCE_CONFIRMED')!=='true')return off();
  }else if(mode==='pilot'){
   const text=readEnv('N88_PILOT_BINDING');
   if(typeof text!=='string'||text.length>2048)return off();
   binding=JSON.parse(text);
   if(!exact(binding,['ownerId','classId','teachingId','studentIds'])||!uuid(binding.ownerId)||!id(binding.classId)||!id(binding.teachingId)||
      !Array.isArray(binding.studentIds)||binding.studentIds.length!==2||binding.studentIds.some(v=>!id(v))||new Set(binding.studentIds).size!==2)return off();
   binding={...binding,studentIds:new Set(binding.studentIds)};
  }else return off();
 }catch{return off();}
 const allowsOwner=ownerId=>uuid(ownerId)&&(mode==='public'||ownerId===binding.ownerId);
 const allowsMember=m=>!!m&&allowsOwner(m.ownerId)&&id(m.studentId)&&id(m.classId)&&
  (mode==='public'||m.classId===binding.classId&&binding.studentIds.has(m.studentId));
 return Object.freeze({
  mode,configured:true,allowsOwner,allowsMember,
  admitsTeacher:(auth,scope)=>!!auth&&auth.current===true&&allowsOwner(auth.ownerId)&&!!scope&&scope.current===true&&
   scope.ownerId===auth.ownerId&&id(scope.classId)&&id(scope.teachingId)&&
   (mode==='public'||scope.classId===binding.classId&&scope.teachingId===binding.teachingId),
  admitsStudent:member=>allowsMember(member)&&member.status==='active'&&member.endDate===null&&member.studentActive===true&&member.classActive===true
 });
}
