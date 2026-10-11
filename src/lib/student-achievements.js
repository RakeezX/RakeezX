import { itemScore } from '../models.js';

/** Read-only facts from the same owner-scoped evidence shown on the profile. */
export function studentAchievements({ studentId, history, items, gradeCtx }) {
  const own = (events) => events.filter(({ record }) => record.studentId === studentId && !record.deleted);
  const participation = own(history.logs).filter(({ record }) =>
    record.kind === 'participation' && Number.isFinite(record.delta) && record.delta > 0).length;
  const present = own(history.attendance).filter(({ record }) => record.status === 'present').length;
  // Automatic projections are already represented by attendance/participation.
  // A manual maximum must be reached by the saved value, not by clamping corrupt data.
  const fullMarks = items.filter((item) => {
    const score = gradeCtx.scoresByItem?.[item.id];
    return !item.deleted && !item.auto && Number.isFinite(item.max) && item.max > 0 &&
      score?.studentId === studentId && !score.deleted && score.value !== null &&
      score.value !== undefined && Number(score.value) === item.max && itemScore(item, gradeCtx) === item.max;
  }).length;
  return [
    participation ? { key: 'participation', count: participation, title: 'مشاركات إيجابية', detail: 'مرات رصد مشاركة بنقاط موجبة · كل السجل', source: 'سجل المشاركة والسلوك' } : null,
    present ? { key: 'attendance', count: present, title: 'حصص بحضور مسجّل', detail: 'حصص مسجلة «حاضر» · كل السجل', source: 'سجل الحضور المستمر' } : null,
    fullMarks ? { key: 'scores', count: fullMarks, title: 'بنود بدرجة كاملة', detail: 'بنود تقييم يدوية · الإسناد المعروض فقط', source: 'الدرجات المعروضة' } : null,
  ].filter(Boolean);
}

const SHARE_FIELDS = Object.freeze({
  participation: { title: 'مشاركات إيجابية', scope: 'من سجل المشاركة المتاح' },
  scores: { title: 'بنود بدرجة كاملة', scope: 'من التقييمات اليدوية في الإسناد المعروض' },
});

/** Recompute from bounded evidence; never copy arbitrary profile fields into an export. */
export function achievementCard(input, { selected = [], includeName = false, studentName = '', demo = false } = {}) {
  const facts = studentAchievements(input);
  return {
    title: 'بطاقة إنجاز',
    name: includeName === true ? String(studentName).replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, 80) : '',
    demo: demo === true,
    evidence: facts.filter(fact => Object.hasOwn(SHARE_FIELDS, fact.key) && selected.includes(fact.key))
      .map(({ key, count }) => ({ key, count, ...SHARE_FIELDS[key] })),
  };
}

/** Draw only the allowlisted projection, never a screenshot of the private profile. */
export function drawAchievementCard(canvas, card) {
  canvas.width = 1000;
  canvas.height = 1040;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = '#faf8f1';
  ctx.fillRect(0, 0, 1000, 1040);
  ctx.strokeStyle = '#c4a25c';
  ctx.lineWidth = 3;
  ctx.strokeRect(30, 30, 940, 980);
  ctx.fillStyle = '#f0e4c5';
  ctx.beginPath(); ctx.arc(500, 130, 64, 0, Math.PI * 2); ctx.fill();
  // A calm trophy, with no ranking, fabricated level or extra points.
  ctx.strokeStyle = '#806324'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(470, 98); ctx.lineTo(530, 98); ctx.lineTo(530, 126);
  ctx.bezierCurveTo(530, 163, 470, 163, 470, 126); ctx.closePath();
  ctx.moveTo(470, 108); ctx.lineTo(450, 108); ctx.bezierCurveTo(450, 135, 455, 138, 474, 138);
  ctx.moveTo(530, 108); ctx.lineTo(550, 108); ctx.bezierCurveTo(550, 135, 545, 138, 526, 138);
  ctx.moveTo(500, 154); ctx.lineTo(500, 174); ctx.moveTo(480, 174); ctx.lineTo(520, 174); ctx.stroke();
  ctx.direction = 'rtl'; ctx.textAlign = 'center';
  const text = (value, y, size, color = '#243c35') => {
    ctx.fillStyle = color; ctx.font = `600 ${size}px "Tajawal", sans-serif`;
    ctx.fillText(value, 500, y, 860);
  };
  text(card.title, 245, 48);
  if (card.name) text(card.name, 310, 34);
  text('نحتفي بالجهد والإنجاز الموثّق', 365, 26, '#596861');
  card.evidence.forEach((fact, index) => {
    const y = 425 + index * 210;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(80, y, 840, 185);
    text(String(fact.count), y + 55, 42, '#806324');
    text(fact.title, y + 105, 32);
    text(fact.scope, y + 150, 23, '#596861');
  });
  if (!card.evidence.length) text('اختر إنجازًا موثّقًا للمعاينة', 545, 28, '#596861');
  text(card.demo ? 'بيانات تجريبية · رَكيز المعلم' : 'رَكيز المعلم', 950, 25, '#596861');
  return canvas;
}

export function achievementPng(canvas, card, confirmed = false) {
  if (confirmed !== true || !card.evidence.length) return Promise.reject(new Error('Teacher selection and confirmation required'));
  return new Promise((resolve, reject) => canvas.toBlob(blob =>
    blob ? resolve(blob) : reject(new Error('PNG unavailable')), 'image/png'));
}
