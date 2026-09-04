import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(
  new URL('../supabase/migrations/0010_profile_report_principal_name.sql', import.meta.url),
  'utf8',
);

test('0010 adds a non-null, defaulted synced principal field without changing profile identity', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`
      create schema rakeezx;
      create table rakeezx.profile (
        owner_id uuid primary key,
        teacher_name text not null default '',
        school_name text not null default '',
        phone text not null default ''
      );
    `);

    await pg.exec(migration);

    const column = await pg.query(`
      select is_nullable, column_default
      from information_schema.columns
      where table_schema = 'rakeezx'
        and table_name = 'profile'
        and column_name = 'report_principal_name'
    `);
    assert.equal(column.rows.length, 1);
    assert.equal(column.rows[0].is_nullable, 'NO');
    assert.match(column.rows[0].column_default, /''::text/);

    await pg.exec("insert into rakeezx.profile (owner_id) values ('00000000-0000-0000-0000-000000000001');");
    const row = await pg.query('select report_principal_name from rakeezx.profile');
    assert.equal(row.rows[0].report_principal_name, '');
  } finally {
    await pg.close();
  }
});
