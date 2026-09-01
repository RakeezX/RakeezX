/**
 * RAKEEZ X — نظام المؤثرات البصرية التفاعلية.
 * خفيف، مقيّد، يحترم prefers-reduced-motion، ولا يسبب أي تزحزح في التخطيط أو تراكم في الـ DOM.
 */

let overlayEl = null;

function isReducedMotion() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function getOverlay() {
  if (typeof document === 'undefined') return null;
  if (!overlayEl || !document.body.contains(overlayEl)) {
    overlayEl = document.getElementById('effect-overlay');
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.id = 'effect-overlay';
      overlayEl.className = 'effect-overlay';
      overlayEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(overlayEl);
    }
  }
  return overlayEl;
}

/**
 * احتفال الفائز في القرعة (نبضة مضيئة وقطع احتفالية رقيقة ومحصورة).
 */
export function showWinnerCelebration(stageEl) {
  if (!stageEl) return;

  stageEl.classList.remove('is-winner');
  // إجبار إعادة حساب التدفق لتفعيل التحريك من جديد
  void stageEl.offsetWidth;
  stageEl.classList.add('is-winner');

  setTimeout(() => {
    stageEl.classList.remove('is-winner');
  }, 1600);

  if (isReducedMotion()) return;

  const overlay = getOverlay();
  if (!overlay) return;

  const rect = stageEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const colors = [
    '#18A878', // RAKEEZ Brand Green
    '#2563EB', // RAKEEZ Blue
    '#F59E0B', // Warm Amber / Gold
    '#10B981', // Emerald
    '#6366F1', // Indigo Accent
  ];

  const count = 16;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'effect-confetti';

    const angle = (i / count) * 2 * Math.PI + (Math.random() * 0.4 - 0.2);
    const distance = 40 + Math.random() * 75;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - (15 + Math.random() * 20);
    const rot = (Math.random() * 360) - 180;
    const color = colors[i % colors.length];
    const size = 6 + Math.random() * 5;

    particle.style.setProperty('--dx', `${dx}px`);
    particle.style.setProperty('--dy', `${dy}px`);
    particle.style.setProperty('--rot', `${rot}deg`);
    particle.style.setProperty('--bg', color);
    particle.style.width = `${size}px`;
    particle.style.height = `${size * (Math.random() > 0.5 ? 1 : 1.6)}px`;
    particle.style.left = `${centerX}px`;
    particle.style.top = `${centerY}px`;

    overlay.appendChild(particle);

    const cleanup = () => {
      particle.remove();
    };

    particle.addEventListener('animationend', cleanup, { once: true });
    setTimeout(cleanup, 1200);
  }
}
