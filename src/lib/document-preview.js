import { html, icon, openSheet } from './dom.js';

let stylesheetReady;
function loadStyles() {
  if (!stylesheetReady) stylesheetReady = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../styles/document-preview.css', import.meta.url).href;
    link.onload = resolve;
    link.onerror = () => { link.remove(); stylesheetReady = null; reject(new Error('تعذر تحميل المعاينة')); };
    document.head.append(link);
  });
  return stylesheetReady;
}

/** Read-only snapshot. The caller retains its original canvas and document state. */
export async function openDocumentPreview({ title, canvas, description = '' }) {
  if (!canvas || !canvas.width || !canvas.height || typeof canvas.getContext !== 'function') {
    throw new TypeError('تعذر فتح معاينة المستند');
  }
  const snapshot = document.createElement('canvas');
  snapshot.width = canvas.width;
  snapshot.height = canvas.height;
  const context = snapshot.getContext('2d');
  if (!context) throw new Error('تعذر فتح معاينة المستند');
  context.drawImage(canvas, 0, 0);
  snapshot.className = 'document-preview__canvas';
  snapshot.setAttribute('role', 'img');
  snapshot.setAttribute('aria-label', canvas.getAttribute('aria-label') || description || title || 'معاينة المستند');
  snapshot.textContent = snapshot.getAttribute('aria-label');
  await loadStyles();
  if (!canvas.isConnected) return;
  let cleanup = () => {};
  try {
    return await openSheet({
      title: title || 'معاينة المستند',
      desc: description,
      body: html`
        <div class="document-preview__toolbar" role="group" aria-label="حجم المعاينة">
          <button type="button" class="iconbtn" data-preview-zoom-out aria-label="تصغير">${icon('minus')}</button>
          <output class="document-preview__percent" aria-live="polite" aria-atomic="true" aria-label="نسبة حجم المعاينة" dir="ltr">100%</output>
          <button type="button" class="iconbtn" data-preview-zoom-in aria-label="تكبير">${icon('plus')}</button>
          <button type="button" class="btn btn--ghost" data-preview-fit>ملاءمة للشاشة</button>
        </div>
        <div class="document-preview__viewport" tabindex="0" role="region" aria-label="المستند — يمكن التمرير عند التكبير">
          <div class="document-preview__stage"><div class="document-preview__page"></div></div>
        </div>`,
      onMount(root) {
        root.classList.add('document-preview-backdrop');
        root.querySelector('.sheet').classList.add('document-preview-sheet');
        const viewport = root.querySelector('.document-preview__viewport');
        const page = root.querySelector('.document-preview__page');
        const percent = root.querySelector('.document-preview__percent');
        const smaller = root.querySelector('[data-preview-zoom-out]');
        const larger = root.querySelector('[data-preview-zoom-in]');
        const fit = root.querySelector('[data-preview-fit]');
        page.append(snapshot);
        let zoom = 1;
        const zoomSteps = [.5, .75, 1, 1.25, 1.5, 2, 3, 4, 6];
        let frame = 0;
        let disposed = false;
        const paint = () => {
          if (disposed) return;
          const styles = getComputedStyle(viewport);
          const width = Math.max(1, viewport.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight));
          const height = Math.max(1, viewport.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom));
          const scale = Math.min(width / snapshot.width, height / snapshot.height) * zoom;
          page.style.width = `${snapshot.width * scale}px`;
          page.style.height = `${snapshot.height * scale}px`;
          snapshot.style.width = '100%';
          snapshot.style.height = '100%';
          percent.textContent = `${Math.round(zoom * 100)}%`;
          smaller.disabled = zoom <= .5;
          larger.disabled = zoom >= zoomSteps.at(-1);
          fit.setAttribute('aria-pressed', String(zoom === 1));
        };
        const resize = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(paint); };
        const change = (value) => {
          zoom = Math.max(zoomSteps[0], Math.min(zoomSteps.at(-1), value));
          paint();
        };
        const onSmaller = () => change([...zoomSteps].reverse().find(step => step < zoom) ?? zoomSteps[0]);
        const onLarger = () => change(zoomSteps.find(step => step > zoom) ?? zoomSteps.at(-1));
        const onFit = () => { change(1); viewport.scrollTop = 0; viewport.scrollLeft = 0; };
        smaller.addEventListener('click', onSmaller);
        larger.addEventListener('click', onLarger);
        fit.addEventListener('click', onFit);
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
        observer?.observe(viewport);
        window.addEventListener('resize', resize);
        cleanup = () => {
          disposed = true;
          cancelAnimationFrame(frame);
          observer?.disconnect();
          window.removeEventListener('resize', resize);
          smaller.removeEventListener('click', onSmaller);
          larger.removeEventListener('click', onLarger);
          fit.removeEventListener('click', onFit);
          // Release the owned bitmap after the sheet has closed.
          snapshot.width = 0;
          snapshot.height = 0;
        };
        paint();
        resize();
      },
    });
  } finally { cleanup(); }
}
