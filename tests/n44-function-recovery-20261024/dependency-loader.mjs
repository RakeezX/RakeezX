// AI: resolve the unchanged pinned private-service SDK in task-local test dependencies.
import {registerHooks, createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(new URL('./dependencies/package.json',import.meta.url));
const sdk=require.resolve('@supabase/auth-js');
registerHooks({resolve(specifier,context,next){
 if(specifier==='@supabase/auth-js')return next(pathToFileURL(sdk).href,context);
 return next(specifier,context);
}});
