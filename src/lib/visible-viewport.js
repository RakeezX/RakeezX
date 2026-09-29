// N20: CSS dvh alone does not follow keyboards that resize only the visual viewport.
// Shared presentation geometry; no scrolling locks or account/data behavior.
let installed = false;
export function installVisibleViewport() {
  if (installed) return;
  installed = true;
  const viewport = window.visualViewport;
  let frame;
  let revealFrame;
  let pendingReveal = false;
  const editable = (field) => field?.matches('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea, select');
  const scrollOwner = (field) => {
    const sheetBody = field.closest('.sheet__body');
    let owner = sheetBody;
    if (!owner) {
      // Ordinary forms use their existing nearest scroll owner, not a second
      // page lock or unconditional scrollIntoView through every ancestor.
      for (let node = field.parentElement; node; node = node.parentElement) {
        if (/auto|scroll/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight) {
          owner = node;
          break;
        }
      }
      owner ??= document.scrollingElement;
    }
    return owner;
  };
  const revealFocused = (field, top, bottom) => {
    const owner = scrollOwner(field);
    if (!owner) return;
    if (owner !== document.scrollingElement) {
      const region = owner.getBoundingClientRect();
      top = Math.max(top, region.top);
      bottom = Math.min(bottom, region.bottom);
    }
    const header = field.closest('.main')?.querySelector('.topbar');
    if (header && !header.contains(field)) {
      const region = header.getBoundingClientRect();
      if (region.top <= top && region.bottom > top) top = region.bottom;
    }
    top += 12;
    bottom -= 12;
    if (bottom <= top) return;
    const rect = field.getBoundingClientRect();
    // A tall textarea can exceed the region: expose its start, rather than
    // alternating between two impossible full-containment corrections.
    const tall = rect.height > bottom - top;
    const delta = rect.top < top ? rect.top - top
      : rect.bottom > bottom ? (tall ? rect.top - top : rect.bottom - bottom) : 0;
    if (delta) owner.scrollTop += delta;
  };
  let observedOwner;
  // The focused body's layout can settle after the viewport event/frame.
  // Observe only its box, not scrolling, so natural panning is not opposed.
  const observer = window.ResizeObserver ? new window.ResizeObserver(() => update(true)) : null;
  const observeFocused = () => {
    const field = document.activeElement;
    const owner = editable(field) ? scrollOwner(field) : null;
    const target = owner === document.scrollingElement ? null : owner;
    if (target === observedOwner) return;
    observer?.disconnect();
    observedOwner = target;
    if (target) observer?.observe(target);
  };
  const update = (reveal = false) => {
    if (reveal) observeFocused();
    pendingReveal ||= reveal;
    cancelAnimationFrame(frame);
    cancelAnimationFrame(revealFrame);
    frame = requestAnimationFrame(() => {
      // VisualViewport values are CSS pixels, including during user zoom.
      // Scale alone must not discard the actual visible region.
      const height = viewport?.height > 0 ? viewport.height : window.innerHeight;
      const top = Math.max(0, viewport?.offsetTop ?? 0);
      document.documentElement.style.setProperty('--visible-viewport-height', `${height}px`);
      document.documentElement.style.setProperty('--visible-viewport-top', `${top}px`);
      document.documentElement.style.setProperty('--visible-viewport-covered-bottom', `${Math.max(0, window.innerHeight - top - height)}px`);
      document.documentElement.toggleAttribute('data-viewport-compressed', window.innerWidth < 700 && height < window.innerHeight - 1);
      const revealField = pendingReveal;
      // Measure after inherited viewport CSS has reached the sheet/body layout.
      revealFrame = requestAnimationFrame(() => {
        // A resize-induced scroll may replace this frame. Keep the request
        // pending until correction actually runs, rather than silently losing it.
        pendingReveal = false;
        const field = document.activeElement;
        if (revealField && editable(field) && (field.closest('.sheet, [data-account-profile-required]') || height < window.innerHeight - 1)) {
          revealFocused(field, top, top + height);
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
