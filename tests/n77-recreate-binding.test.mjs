import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
const normalized = value => value.replace(/\s+/g, ' ').trim();
test('recorded real service readback binds the certified migration, ACL and unchanged delete guards', async () => {
  const evidence = JSON.parse(await readFile(new URL('./n77-recreate-service-readback.json', import.meta.url), 'utf8'));
  // Bind Git's LF source even on Windows checkouts with autocrlf enabled.
  const sql = (await readFile(new URL(`../supabase/migrations/${evidence.migration.version}_n77_recreate_fresh_identity.sql`, import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
  assert.equal(evidence.projectId, 'xlrubcwjqktzzunrvuns');
  assert.equal(evidence.authority, 'PO-20261013-N77-explicit-recreation');
  assert.equal(evidence.applyResult.success, true);
  assert.equal(hash(sql), evidence.sourceSha256);
  assert.equal(evidence.sourceSha256, evidence.nativeCertification.migrationSha256);
  const fn = evidence.currentFunction.definition;
  assert.equal(hash(fn), evidence.nativeCertification.functionSha256);
  assert.equal(normalized(fn.slice(fn.indexOf('$function$') + 10, fn.lastIndexOf('$function$'))),
    normalized(sql.slice(sql.indexOf('as $$') + 5, sql.lastIndexOf('$$;'))));
  for (const prior of evidence.before.functions) {
    const next = evidence.after.functions.find(fn => fn.name === prior.name);
    assert.equal(next.acl, prior.acl);
    if (prior.name !== evidence.currentFunction.name) assert.equal(next.definitionSha256, prior.definitionSha256);
  }
  assert.equal(evidence.after.naturalConstraint, null);
  const index = evidence.after.indexes.find(i => i.name === 'teachings_natural_uniq');
  assert.equal(index.definition, 'CREATE UNIQUE INDEX teachings_natural_uniq ON rakeezx.teachings USING btree (owner_id, section_id, subject_id, term_id) WHERE (deleted_at IS NULL)');
  for (const prior of evidence.before.indexes.filter(i => i.name !== index.name)) assert.deepEqual(evidence.after.indexes.find(i => i.name === prior.name), prior);
});
