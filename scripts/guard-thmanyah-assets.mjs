import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { protectedFaces } from '../src/lib/thmanyah-payload.js';
import { decodeProtectedFace } from '../src/lib/thmanyah-font.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const banned = new Set(['.woff2', '.woff', '.otf', '.ttf', '.zip']);
const standalone = [];
const inspect = (path) => {
  if (banned.has(extname(path).toLowerCase())) standalone.push(relative(root, path));
  const bytes = readFileSync(path);
  if (bytes.subarray(0, 4).toString() === 'wOF2') standalone.push(relative(root, path));
};
for (const path of execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean)) {
  if (existsSync(join(root, path))) inspect(join(root, path));
}
const scan = (dir) => {
  if (!existsSync(dir)) return;
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) scan(path);
    else inspect(path);
  }
};
scan(join(root, 'assets'));
scan(join(root, 'src'));
scan(join(root, 'dist'));
if (standalone.length) throw new Error(`Standalone font/archive assets: ${standalone.join(', ')}`);
const weights = Object.keys(protectedFaces).sort();
if (weights.join(',') !== '400,500,700,900') throw new Error(`Unexpected weights: ${weights}`);
for (const weight of weights) {
  const entry = protectedFaces[weight];
  const bytes = decodeProtectedFace(entry, weight);
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== entry.sha256) throw new Error(`Byte mismatch: ${weight}`);
  console.log(`${weight} ${entry.name} ${bytes.length} ${hash}`);
}
console.log(`PASS: ${weights.length} protected faces; no standalone raw font/archive assets`);
