/** AI: separate injected local teacher controller. No Student toolbar/store import. */
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export async function mountTeacherInvitations(root, { client, studentUrl, copy = text => navigator.clipboard.writeText(text), print = () => window.print() }) {
  let members = [], selected = null, generation = 0, disposed = false, busy = false;
  const url = new URL(studentUrl);
  if (url.origin !== root.ownerDocument.location.origin || url.search || url.hash) throw Error('Same-origin private destination required');
  root.classList.add('n88-portal'); root.dir = 'rtl';
  function show(message = '') {
    if (disposed) return;
    root.innerHTML = `<main><h1>دعوة طالب خاصة</h1><p>اختر عضوية حالية موثّقة. سلّم الدعوة لهذا الطالب وحده بعد التحقق منه.</p><form data-select><label for="n88-member">الطالب المسجّل حاليًا</label><select id="n88-member" required><option value="">اختر الطالب</option>${members.map(m => `<option value="${escape(m.enrollmentId)}">${escape(m.label)}</option>`).join('')}</select><button type="submit">مراجعة الدعوة</button></form><div data-review></div><p role="status">${escape(message)}</p></main>`;
  }
  async function refresh() {
    const id = ++generation; selected = null;
    try { const result = await client.students(); if (!disposed && id === generation) { members = result.students; show(); } }
    catch { if (!disposed && id === generation) { members = []; show('تعذّر التحقق من الحساب أو العضوية.'); } }
  }
  const submit = e => {
    if (!e.target.matches('[data-select]')) return;
    e.preventDefault();
    selected = members.find(m => m.enrollmentId === root.querySelector('select').value);
    if (!selected) return;
    root.querySelector('[data-review]').innerHTML = `<section class="n88-panel"><h2>${escape(selected.label)}</h2><p>للقراءة فقط · دعوة واحدة صالحة 15 دقيقة. إعادة الإصدار تلغي الدعوة والجلسة السابقة.</p><button data-issue type="button">إصدار دعوة خاصة</button><button data-revoke type="button">إلغاء وصول الطالب</button><button data-cancel type="button">إلغاء</button></section>`;
  };
  const click = async e => {
    if (e.target.closest('[data-cancel]')) { generation++; selected = null; show(); return; }
    if (e.target.closest('[data-copy]')) {
      try { await copy(root.querySelector('textarea').value); root.querySelector('[role=status]').textContent = 'نُسخ الرابط الخاص. سلّمه للطالب وحده.'; }
      catch { root.querySelector('[role=status]').textContent = 'انسخ الرابط الكامل يدويًا من الحقل.'; }
      return;
    }
    if (e.target.closest('[data-print]')) { print(); return; }
    const action = e.target.closest('[data-issue]') ? 'issue' : e.target.closest('[data-revoke]') ? 'revoke' : null;
    if (!action || !selected || busy) return;
    busy = true; const id = ++generation, member = selected;
    root.querySelector('[data-review]').replaceChildren();
    try {
      const result = await client[action](member);
      if (disposed || id !== generation) return;
      if (action === 'revoke') { show('أُلغي الوصول.'); return; }
      const privateLink = url.href + '#invite=' + result.token;
      root.querySelector('[data-review]').innerHTML = `<section class="n88-panel"><h2>دعوة ${escape(member.label)}</h2><p>صالحة حتى <time>${escape(new Date(result.expiresAt).toISOString())}</time>. احفظها بشكل خاص؛ لن نعرضها بعد إغلاق هذه الصفحة.</p><label for="n88-link">الرابط الخاص الكامل</label><textarea id="n88-link" dir="ltr" readonly spellcheck="false"></textarea><button data-copy type="button">نسخ الرابط</button><button data-print type="button">طباعة الدعوة</button><button data-cancel type="button">إغلاق ومسح الرابط</button></section>`;
      root.querySelector('textarea').value = privateLink;
      root.querySelector('textarea').focus();
    } catch { if (!disposed && id === generation) show('تعذّر الإصدار أو الإلغاء. أعد التحقق من العضوية والحساب.'); }
    finally { busy = false; }
  };
  root.addEventListener('submit', submit); root.addEventListener('click', click);
  await refresh();
  return { async contextChanged() { generation++; members = []; selected = null; root.replaceChildren(); await refresh(); },
    dispose() { disposed = true; generation++; selected = null; members = []; root.replaceChildren();
      root.removeEventListener('submit', submit); root.removeEventListener('click', click); } };
}
