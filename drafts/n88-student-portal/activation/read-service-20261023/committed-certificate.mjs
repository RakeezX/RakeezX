/** AI: read only the named public Git artifact; never another custody directory. */
import {execFileSync} from 'node:child_process';
export const certificatePath='tests/n44-device-20261023/configuration-delta-certificate.json';
export function committedCertificateBytes(worktree,revision){
 const deny=code=>{throw Error('n88_typed_certificate_'+code);};
 if(!/^[a-f0-9]{40}$/.test(revision??''))deny('revision');
 const git=args=>execFileSync('git',args,{cwd:worktree,maxBuffer:1048576,stdio:['ignore','pipe','pipe']});
 if(git(['rev-parse','HEAD']).toString().trim()!==revision)deny('head');
 if(git(['status','--porcelain','--untracked-files=all','--',certificatePath]).toString().trim())deny('uncommitted');
 try{git(['ls-files','--error-unmatch','--',certificatePath]);return git(['show',revision+':'+certificatePath,'--']);}catch{deny('missing');}
}
