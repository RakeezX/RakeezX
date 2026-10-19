// AI: immutable package bytes must match the exact committed extension source.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {execFileSync} from 'node:child_process';
import {unzipSync} from '../../src/lib/student-import-parsers.js';
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const manifest=JSON.parse(await fs.readFile('assets/extensions/rakeez-teacher-import-helper-0.5.15.manifest.json','utf8'));
const zip=unzipSync(await fs.readFile('assets/extensions/'+manifest.archive.file));
for(const f of manifest.files)assert.deepEqual(Buffer.from(zip[f.file]),execFileSync('git',['show',sha+':extensions/rakeez-teacher-import-helper/'+f.file]),f.file);
console.log('PASS 25 package entries match committed extension source at '+sha);
