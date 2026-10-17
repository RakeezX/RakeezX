/** AI: injected teacher pilot only; current server auth selects owner. No real app wiring. */
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export async function mountTeacherInvitations(root, { client, copy = text => navigator.clipboard.writeText(text), print = () => window.print() }) {
  let members = [], namespace = '', selected = null, generation = 0, disposed = false, busy = false;
  root.classList.add('n88-portal'); root.dir = 'rtl';
  function show(message = '') {
    if (disposed) return;
    root.innerHTML = `<header><span class="n88-brand">رَكيز المعلم</span><span>متابعة الطالب</span></header><main><h1>رمز الطالب الشخصي</h1><p>اختر الطالب المسجّل وتحقق من هويته قبل تسليم رمزه. الرمز دائم حتى تغييره أو إلغائه؛ لا يُرسل تلقائيًا.</p><form data-select><label for="n88-member">الطالب المسجّل حاليًا</label><select id="n88-member" required><option value="">اختر الطالب</option>${members.map(m => `<option value="${escape(m.enrollmentId)}">${escape(m.label)}</option>`).join('')}</select><button type="submit">إدارة وصول الطالب</button></form><div data-review></div><p role="status">${escape(message)}</p></main>`;
  }
  async function refresh() {
    const id = ++generation; selected = null;
    try { const result = await client.students(); if (!disposed && id === generation) { members = result.students; namespace = result.namespace; show(); } }
    catch { if (!disposed && id === generation) { members = []; namespace = ''; show('تعذّر التحقق من الحساب أو العضوية.'); } }
  }
  function review() {
    root.querySelector('[data-review]').innerHTML = `<section class="n88-panel"><h2>${escape(selected.label)}</h2><p>إنشاء رمز جديد يلغي الرمز القديم وجميع جلساته فورًا. إذا نُسي الرمز، أنشئ بديلًا؛ لا يمكن استرجاع القديم.</p><button data-issue type="button">إنشاء / تغيير الرمز</button><button data-revoke type="button">إلغاء وصول الطالب</button><button data-cancel type="button">إغلاق</button><form data-publish><h3>تحديث نشاط الطالب</h3><label for="n88-title">عنوان النشاط المنشور</label><input id="n88-title" name="title" maxlength="160" required><label for="n88-status">الحالة</label><select id="n88-status" name="status"><option value="working">قيد العمل</option><option value="done">مكتمل</option><option value="todo">لم يبدأ</option></select><label><input name="published" type="checkbox" checked> نشر للطالب</label><button type="submit">حفظ متابعة الطالب</button></form></section>`;
    const form = root.querySelector('[data-publish]');
    const label = root.ownerDocument.createElement('label'); label.htmlFor = 'n88-publication'; label.textContent = 'النشاط';
    const select = root.ownerDocument.createElement('select'); select.id = 'n88-publication'; select.name = 'publication';
    select.innerHTML = selected.publications.map(p => `<option value="${escape(p.id)}">${escape(p.title)}</option>`).join('');
    form.prepend(label, select);
    const populate = () => { const p = selected.publications.find(p => p.id === select.value);
      if (p) { form.elements.title.value = p.title; form.elements.status.value = p.status; form.elements.published.checked = p.published; } };
    select.addEventListener('change', populate); populate();
  }
  const submit = async e => {
    if (e.target.matches('[data-select]')) {
      e.preventDefault(); if (busy) return;
      generation++; selected = members.find(m => m.enrollmentId === root.querySelector('#n88-member').value);
      if (selected) review(); return;
    }
    if (!e.target.matches('[data-publish]')) return;
    e.preventDefault(); if (!selected || busy) return;
    const form = e.target, member = selected, id = ++generation;
    const update = { publicationId: form.elements.publication.value,
      title: form.elements.title.value, status: form.elements.status.value, published: form.elements.published.checked };
    busy = true;
    try { await client.publish(member, update); if (!disposed && id === generation) {
      Object.assign(member.publications.find(p => p.id === update.publicationId), update);
      root.querySelector('[role=status]').textContent = 'حُفظ التحديث. يظهر للطالب عند التحديث.'; } }
    catch { if (!disposed && id === generation) root.querySelector('[role=status]').textContent = 'تعذّر حفظ التحديث.'; }
    finally { busy = false; }
  };
  const click = async e => {
    if (e.target.closest('[data-cancel]')) { generation++; selected = null; show(); return; }
    if (e.target.closest('[data-copy]')) {
      try { await copy(root.querySelector('[data-code]').value + '\n' + root.querySelector('[data-entry]').value); }
      catch { /* manual copy remains available */ } return;
    }
    if (e.target.closest('[data-print]')) { print(); return; }
    const action = e.target.closest('[data-issue]') ? 'issue' : e.target.closest('[data-revoke]') ? 'revoke' : null;
    if (!action || !selected || busy) return;
    busy = true; const id = ++generation, member = selected;
    root.querySelector('[data-review]').replaceChildren();
    try {
      const result = await client[action](member);
      if (disposed || id !== generation) return;
      if (action === 'revoke') { show('أُلغي الوصول والرمز وجميع الجلسات.'); return; }
      if (result.namespace !== namespace || !/^[A-Za-z0-9_-]{24,64}$/.test(namespace) || !/^[0-9]{6}$/.test(result.code)) throw Error('invalid');
      root.querySelector('[data-review]').innerHTML = `<section class="n88-panel"><h2>رمز ${escape(member.label)}</h2><p>يُعرض الآن فقط. سلّمه لهذا الطالب وحده بعد التحقق منه، ثم أغلق العرض. يحتفظ الطالب بالرابط ويستخدم الرمز نفسه في كل زيارة.</p><label for="n88-code">الرمز الشخصي</label><input data-code id="n88-code" dir="ltr" readonly autocomplete="off"><label for="n88-entry">رابط معلمك للطلاب</label><input data-entry id="n88-entry" dir="ltr" readonly><button data-copy type="button">نسخ الرمز والرابط</button><button data-print type="button">طباعة</button><button data-cancel type="button">إغلاق ومسح الرمز</button></section>`;
      root.querySelector('[data-code]').value = result.code;
      root.querySelector('[data-entry]').value = root.ownerDocument.location.origin + '/s/' + namespace;
      root.querySelector('[data-code]').focus();
    } catch { if (!disposed && id === generation) show('تعذّر الإنشاء أو الإلغاء. أعد التحقق من العضوية والحساب.'); }
    finally { busy = false; }
  };
  const clear = () => { generation++; selected = null; show(); };
  root.addEventListener('submit', submit); root.addEventListener('click', click);
  root.ownerDocument.defaultView.addEventListener('pagehide', clear);
  await refresh();
  return { async contextChanged() { generation++; members = []; selected = null; root.replaceChildren(); await refresh(); },
    dispose() { disposed = true; generation++; selected = null; members = []; root.replaceChildren();
      root.removeEventListener('submit', submit); root.removeEventListener('click', click); root.ownerDocument.defaultView.removeEventListener('pagehide', clear); } };
}
