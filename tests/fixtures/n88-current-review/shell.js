// AI: manual-review navigation outside the untouched Product view.
const link = document.querySelector('[data-review-student]');
const teacherRoot = document.getElementById('review-teacher');
if (link && teacherRoot) {
  const sync = () => {
    const value = document.querySelector('[data-entry]')?.value;
    link.hidden = !value;
    if (value) link.href = value; else link.removeAttribute('href');
  };
  new MutationObserver(sync).observe(teacherRoot, { childList: true, subtree: true });
}
