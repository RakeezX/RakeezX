// AI-authored scoped source contract assertions; rendered evidence is separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { match } from '../src/router.js';
test('all Koshoof routes load the identical shared view and grades has no transfer engine',async()=>{
 const routes=['/classes/koshoof','/classes/import','/teaching/synthetic/koshoof?export=1'];
 const views=await Promise.all(routes.map(async path=>(await match(path).route.load()).default));
 assert.ok(views.every(v=>v===views[0]));
 const grades=await readFile('src/views/grades.js','utf8');
 assert.doesNotMatch(grades,/function transferPanel|function transferConfirm|let transfer =|koshoofView/);
 const hub=await readFile('src/views/class-import-center.js','utf8');
 assert.match(hub,/hub.files.slice\(0, 3\)/);assert.match(hub,/Rebuild under current owner/);
 assert.doesNotMatch(await readFile('src/lib/class-koshoof-bundle.js','utf8'),/application\/zip|import \{ zip \}/);
});
