begin;

create or replace function rakeezx.normalize_section_label(value text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select translate(
    -- Exactly ECMAScript trim()/\s whitespace, independent of DB locale.
    -- U+0085, U+180E and U+200B are deliberately NOT whitespace here.
    btrim(regexp_replace(translate(coalesce(value, ''),
      U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF',
      repeat(' ', 25)), ' +', ' ', 'g')),
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹إأآٱ',
    '01234567890123456789اااا'
  );
$$;

-- Create the replacement BEFORE removing the old protection. Active
-- normalized duplicates abort this transaction; no rows/IDs are repaired here.
create unique index sections_active_normalized_natural_uniq
  on rakeezx.sections (
    owner_id,
    year_id,
    grade,
    rakeezx.normalize_section_label(label)
  )
  where deleted_at is null;

alter table rakeezx.sections drop constraint if exists sections_natural_uniq;

commit;
