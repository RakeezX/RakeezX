// Read-only comparison of the old Node harness failure against the exact base.
import { registerHooks } from 'node:module';
import { execFileSync } from 'node:child_process';
const target = new URL('../../../src/lib/sync.js', import.meta.url).href;
const source = execFileSync('git', ['show', '210cce3813b4cf1b45269f671d87fb5221076ab2:src/lib/sync.js'], {encoding:'utf8'});
registerHooks({load(url, context, nextLoad) {
  return url === target ? {format:'module',source,shortCircuit:true} : nextLoad(url,context);
}});
