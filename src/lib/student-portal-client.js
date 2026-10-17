/** AI: inert injectable client. Importing never starts network, routing or storage. */
export function createStudentPortalClient({ fetch: send, base = '/api/n88' } = {}) {
  if (typeof send !== 'function' || !/^\/[a-z0-9/_-]+$/i.test(base)) throw Error('Same-origin transport required');
  async function call(path, body) {
    const response = await send(base + path, { method: body ? 'POST' : 'GET',
      credentials: 'same-origin', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
      headers: body ? { 'Content-Type': 'application/json', 'X-N88-CSRF': '1' } : {},
      ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw Error('unavailable');
    return response.json();
  }
  return Object.freeze({ claim: token => call('/claim', { token }), read: () => call('/read'),
    logout: () => call('/logout', {}), students: () => call('/teacher/students'),
    issue: member => call('/teacher/issue', { enrollmentId: member.enrollmentId, revision: member.revision }),
    revoke: member => call('/teacher/revoke', { enrollmentId: member.enrollmentId, revision: member.revision }) });
}

/** Clear synchronously BEFORE async/module side effects. Never return the URL or log it. */
export function takeInviteFragment(location, history) {
  const fragment = location.hash;
  if (fragment) history.replaceState(null, '', location.pathname); // also discard any query
  else if (location.search) history.replaceState(null, '', location.pathname);
  const match = /^#invite=([A-Za-z0-9_-]{43})$/.exec(fragment);
  return match?.[1] || '';
}
