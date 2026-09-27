// N20: CSS dvh alone does not follow keyboards that resize only the visual viewport.
// Shared presentation geometry; no scrolling locks or account/data behavior.
let installed = false;
export function installVisibleViewport() {
  if (installed) return;
  installed = true;
  const viewport = window.visualViewport;
  let frame;
  let pendingReveal = false;
  const update = (reveal = false) => {
    pendingReveal ||= reveal;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const normalScale = !viewport || Math.abs(viewport.scale - 1) < .01;
      document.documentElement.style.setProperty('--visible-viewport-height', `${normalScale ? viewport?.height ?? window.innerHeight : window.innerHeight}px`);
      document.documentElement.style.setProperty('--visible-viewport-top', `${normalScale ? viewport?.offsetTop ?? 0 : 0}px`);
      const revealField = pendingReveal;
      pendingReveal = false;
      // Measure after inherited viewport CSS has reached the sheet/body layout.
      requestAnimationFrame(() => {
      const field = document.activeElement;
      if (revealField && normalScale && field?.matches('input, textarea, select') && field.closest('.sheet, [data-account-profile-required]')) {
        const rect = field.getBoundingClientRect();
        const top = viewport?.offsetTop ?? 0;
        const bottom = top + (viewport?.height ?? window.innerHeight);
        const body = field.closest('.sheet__body');
        const region = body?.getBoundingClientRect();
        if (body) {
          // Scroll only the sheet body: its footer/header are outside this region.
          if (rect.bottom > region.bottom - 12) body.scrollTop += rect.bottom - region.bottom + 12;
          else if (rect.top < region.top + 12) body.scrollTop -= region.top + 12 - rect.top;
        } else if (rect.top < top + 12 || rect.bottom > bottom - 12) field.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      }
      });
    });
  };
  viewport?.addEventListener('resize', () => update(true));
  viewport?.addEventListener('scroll', () => update());
  window.addEventListener('resize', () => update(true));
  document.addEventListener('focusin', () => update(true));
  update();
}
