/** Bounded PostgREST table read. Count/range prove coverage, not snapshot atomicity. */
export const COMPLETE_READ_PAGE_SIZE = 500;
export const COMPLETE_READ_MAX_PAGES = 256;
export const COMPLETE_READ_MAX_ROWS = 100_000;

function incomplete(reason) {
  return Object.assign(new Error(`Incomplete cloud read: ${reason}`), { code: 'CLOUD_READ_INCOMPLETE' });
}

export async function readCompleteTable({ fetchPage, ownerId, key = 'id', assertAccess = () => {},
  pageSize = COMPLETE_READ_PAGE_SIZE, maxPages = COMPLETE_READ_MAX_PAGES,
  maxRows = COMPLETE_READ_MAX_ROWS } = {}) {
  const rows = [], seen = new Set();
  let expected;
  for (let page = 0; page < maxPages; page++) {
    assertAccess();
    const response = await fetchPage({ offset: rows.length, limit: pageSize });
    assertAccess();
    const data = response?.data;
    const range = /^(?:(\d+)-(\d+)|\*)\/(\d+)$/.exec(response?.contentRange ?? '');
    if (!Array.isArray(data) || data.length > pageSize || !range) throw incomplete('invalid page or exact count');
    const total = Number(range[3]);
    if (!Number.isSafeInteger(total) || total > maxRows) throw incomplete('row bound exceeded');
    if (expected !== undefined && expected !== total) throw incomplete('count changed during read');
    expected = total;
    if (data.length === 0) {
      if (range[1] !== undefined || rows.length !== total) throw incomplete('empty page before completion');
      return rows;
    }
    const start = Number(range[1]), end = Number(range[2]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start !== rows.length ||
        end - start + 1 !== data.length || end >= total) throw incomplete('range does not match page');
    for (const row of data) {
      if (!row || typeof row !== 'object' || Array.isArray(row) || row.owner_id !== ownerId ||
          typeof row[key] !== 'string' || !row[key] || seen.has(row[key])) {
        throw incomplete('invalid owner/identity or repeated page');
      }
      seen.add(row[key]);
      rows.push(row);
    }
    if (rows.length === total) return rows;
  }
  throw incomplete('page bound exceeded');
}
