/** AI: inert same-origin injectable client. No import-time network or storage. */
export function createStudentPortalClient({ fetch: send, base = '/api/n88' } = {}) {
  if (typeof send !== 'function' || !/^\/api\/n88(?:\/s\/[A-Za-z0-9_-]{43})?$/.test(base)) throw Error('Scoped same-origin transport required');
  async function call(path, body) {
    const response = await send(base + path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
      redirect: 'error', referrerPolicy: 'no-referrer', headers: body ? { 'Content-Type': 'application/json', 'X-N88-CSRF': '1' } : {},
      ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw Error('unavailable');
    return response.json();
  }
  return Object.freeze({ claim: code => call('/claim', { code }), read: () => call('/read'), logout: () => call('/logout', {}),
    students: () => call('/teacher/students'),
    issue: member => call('/teacher/issue', { enrollmentId: member.enrollmentId, revision: member.revision }),
    revoke: member => call('/teacher/revoke', { enrollmentId: member.enrollmentId, revision: member.revision }),
    publish: (member, update) => call('/teacher/publish', { ...update, enrollmentId: member.enrollmentId, revision: member.revision }) });
}
export function clearEntryUrl(location, history) {
  if (location.hash || location.search) history.replaceState(null, '', location.pathname);
}
