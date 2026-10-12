// N20: CSS dvh alone does not follow keyboards that resize only the visual viewport.
// Shared presentation geometry; no scrolling locks or account/data behavior.
let installed = false;
// Option A: short mobile form viewports get one page-like scroll surface.
// Geometry alone cannot keep a field readable between fixed sheet chrome.
export function syncSheetViewport(sheet) {
  const viewport = window.visualViewport;
  const normalScale = !viewport || Math.abs(viewport.scale - 1) < .01;
  const height = viewport?.height ?? window.innerHeight;
  const mobile = window.innerWidth < 700 || window.matchMedia('(pointer: coarse)').matches;
  const page = normalScale && mobile && height <= 350 &&
    !!sheet.querySelector('input:not([type="hidden"]), textarea, select');
  if (sheet.classList.contains('sheet--page') === page) return;
  sheet.classList.toggle('sheet--page', page);
  // The old nested scroll offset must not survive a change of scroll owner.
  sheet.scrollTop = 0;
  const body = sheet.querySelector('.sheet__body');
  if (body) body.scrollTop = 0;
}

export function installVisibleViewport() {
  if (installed) return;
  installed = true;
  const viewport = window.visualViewport;
  let frame;
  let revealFrame;
  let pendingReveal = false;
  const update = (reveal = false) => {
    pendingReveal ||= reveal;
    cancelAnimationFrame(frame);
    cancelAnimationFrame(revealFrame);
    frame = requestAnimationFrame(() => {
      const normalScale = !viewport || Math.abs(viewport.scale - 1) < .01;
      document.documentElement.style.setProperty('--visible-viewport-height', `${normalScale ? viewport?.height ?? window.innerHeight : window.innerHeight}px`);
      document.documentElement.style.setProperty('--visible-viewport-top', `${normalScale ? viewport?.offsetTop ?? 0 : 0}px`);
      document.querySelectorAll('.sheet').forEach(syncSheetViewport);
      // Measure after inherited viewport CSS has reached the sheet/body layout.
      revealFrame = requestAnimationFrame(() => {
        const revealField = pendingReveal;
        pendingReveal = false;
        const field = document.activeElement;
        if (revealField && normalScale && field?.matches('input, textarea, select') && field.closest('.sheet, [data-account-profile-required]')) {
          const rect = field.getBoundingClientRect();
          const top = viewport?.offsetTop ?? 0;
          const bottom = top + (viewport?.height ?? window.innerHeight);
          const sheet = field.closest('.sheet');
          const surface = sheet?.classList.contains('sheet--page') ? sheet : field.closest('.sheet__body');
          const region = surface?.getBoundingClientRect();
          if (surface) {
            // Reveal within the current scroll owner, without scrolling the locked
            // application behind the modal or reserving space for fixed chrome.
            const regionTop = Math.max(top, region.top) + 12;
            const regionBottom = Math.min(bottom, region.bottom) - 12;
            if (rect.bottom > regionBottom) surface.scrollTop += rect.bottom - regionBottom;
            else if (rect.top < regionTop) surface.scrollTop -= regionTop - rect.top;
          } else if (rect.top < top + 12 || rect.bottom > bottom - 12) field.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        }
      });
    });
  };
  viewport?.addEventListener('resize', () => update(true));
  viewport?.addEventListener('scroll', () => update());
  window.addEventListener('resize', () => update(true));
  document.addEventListener('focusin', () => update(true));
  document.addEventListener('focusout', () => update());
  update();
}
