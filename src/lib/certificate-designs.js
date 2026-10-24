/** Original certificate artwork. All data is an explicit, local display projection. */

export const CERTIFICATE_DESIGNS = Object.freeze([
  Object.freeze({ id: 'ornate', label: 'ذهبي مزخرف', description: 'زخارف ذهبية دقيقة على ورق عاجي' }),
  Object.freeze({ id: 'school', label: 'أخضر مدرسي', description: 'تصميم مدرسي أنيق بألوان ركيز' }),
]);

export const CERTIFICATE_MEDALS = Object.freeze([
  Object.freeze({ id: 'star', label: 'تميّز' }),
  Object.freeze({ id: 'laurel', label: 'إنجاز' }),
]);

const WIDTH = 1485;
const HEIGHT = 1050;
const CENTER = WIDTH / 2;
const FONT = '"Tajawal", sans-serif';
const INK = '#243e35';
const GOLD = '#a77b2e';
const MUTED = '#767768';

function plain(value, limit) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return Array.from(String(value)
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ').trim()).slice(0, limit).join('');
}

/** Do not pass a full profile to the painter: keep certificate identity deliberately narrow. */
export function certificateMetadata(input = {}) {
  input = input && typeof input === 'object' ? input : {};
  return Object.freeze({
    design: CERTIFICATE_DESIGNS.some(item => item.id === input.design) ? input.design : 'ornate',
    medal: CERTIFICATE_MEDALS.some(item => item.id === input.medal) ? input.medal : 'star',
    schoolName: plain(input.schoolName, 140),
    educationDepartment: plain(input.educationDepartment, 140),
    teacherName: plain(input.teacherName, 100),
    principalName: plain(input.principalName, 100),
    teacherLabel: plain(input.teacherLabel, 40) || 'المعلم',
    principalLabel: plain(input.principalLabel, 40) || 'مدير المدرسة',
    className: plain(input.className, 100),
    subjectName: plain(input.subjectName, 100),
    dateLabel: plain(input.dateLabel, 180),
  });
}

function label(ctx, value, x, y, size, weight = 500, color = INK, width) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  if (width) ctx.fillText(String(value), x, y, width);
  else ctx.fillText(String(value), x, y);
}

function fitted(ctx, value, x, y, width, size, minSize = 16, weight = 700, color = INK) {
  const text = String(value);
  let used = size;
  for (; used > minSize; used -= 1) {
    ctx.font = `${weight} ${used}px ${FONT}`;
    if (ctx.measureText(text).width <= width) break;
  }
  label(ctx, text, x, y, used, weight, color, width);
}

function wrapped(ctx, value, x, y, width, size, lineHeight, color = MUTED, maxLines = 2) {
  const words = String(value).split(/\s+/).filter(Boolean);
  let lines = [];
  let used = size;
  for (; used >= 14; used -= 1) {
    ctx.font = `500 ${used}px ${FONT}`;
    lines = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(candidate).width > width) {
        lines.push(current);
        current = word;
      } else current = candidate;
    }
    if (current) lines.push(current);
    if (lines.length <= maxLines) break;
  }
  if (lines.length > maxLines) lines = [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(' ')];
  lines.forEach((line, index) => label(ctx, line, x, y + index * lineHeight, Math.max(14, used), 500, color, width));
  return lines.length;
}

function line(ctx, x1, y1, x2, y2, color = GOLD, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function polygon(ctx, x, y, outer, inner, points, fill) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const angle = -Math.PI / 2 + i * Math.PI / points;
    const radius = i % 2 ? inner : outer;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function leaf(ctx, x, y, angle, length, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(length * 0.2, -length * 0.4, length * 0.8, -length * 0.35, length, 0);
  ctx.bezierCurveTo(length * 0.8, length * 0.35, length * 0.2, length * 0.4, 0, 0);
  ctx.fill();
  ctx.restore();
}

/** A small botanical flourish, reflected at each corner. */
function corner(ctx, x, y, directionX, directionY) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(directionX, directionY);
  ctx.strokeStyle = '#aa843e';
  ctx.lineWidth = 1.4;
  for (const transpose of [false, true]) {
    ctx.save();
    if (transpose) { ctx.rotate(Math.PI / 2); ctx.scale(1, -1); }
    ctx.beginPath();
    ctx.moveTo(0, 138);
    ctx.bezierCurveTo(0, 80, 26, 25, 126, 15);
    ctx.bezierCurveTo(144, 12, 155, 19, 150, 30);
    ctx.bezierCurveTo(144, 41, 130, 35, 135, 26);
    ctx.stroke();
    for (let i = 0; i < 5; i += 1) {
      const px = 19 + i * 20;
      const py = 66 - i * 10;
      leaf(ctx, px, py, -1.08, 25 - i, i % 2 ? '#cfb87a' : '#b89651');
      leaf(ctx, px + 3, py + 1, 0.54, 21 - i, '#c8aa63');
    }
    ctx.restore();
  }
  ctx.strokeStyle = '#c8af73';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(25, 25, 21, 0, Math.PI * 2);
  ctx.stroke();
  polygon(ctx, 25, 25, 17, 7, 8, '#b58d3b');
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  ctx.arc(25, 25, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function guilloche(ctx, y, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.65;
  for (const phase of [0, Math.PI]) {
    ctx.beginPath();
    for (let x = 215; x <= WIDTH - 215; x += 2) {
      const py = y + Math.sin((x - 215) / 10 + phase) * 3.2;
      if (x === 215) ctx.moveTo(x, py); else ctx.lineTo(x, py);
    }
    ctx.stroke();
  }
}

function ornateBackground(ctx) {
  const paper = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  paper.addColorStop(0, '#faf3df');
  paper.addColorStop(0.45, '#fffdf7');
  paper.addColorStop(1, '#f7efda');
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = '#b18a3f';
  ctx.lineWidth = 2;
  ctx.strokeRect(27, 27, WIDTH - 54, HEIGHT - 54);
  ctx.strokeStyle = '#dfcda5';
  ctx.lineWidth = 1;
  ctx.strokeRect(37, 37, WIDTH - 74, HEIGHT - 74);
  ctx.strokeRect(49, 49, WIDTH - 98, HEIGHT - 98);
  guilloche(ctx, 43, '#ba9d5c');
  guilloche(ctx, HEIGHT - 43, '#ba9d5c');
  for (const [x, y, dx, dy] of [[62, 62, 1, 1], [WIDTH - 62, 62, -1, 1], [62, HEIGHT - 62, 1, -1], [WIDTH - 62, HEIGHT - 62, -1, -1]]) corner(ctx, x, y, dx, dy);
  for (const x of [43, WIDTH - 43]) {
    for (let y = 245; y <= 805; y += 28) polygon(ctx, x, y, 3, 1.4, 4, '#ceb77d');
  }
}

function schoolBackground(ctx) {
  ctx.fillStyle = '#fdfdf8';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const green = ctx.createLinearGradient(0, 0, WIDTH, 200);
  green.addColorStop(0, '#103e34');
  green.addColorStop(0.6, '#225b47');
  green.addColorStop(1, '#133d35');
  ctx.fillStyle = green;
  ctx.fillRect(0, 0, WIDTH, 179);
  ctx.fillStyle = '#173f34';
  ctx.fillRect(0, 961, WIDTH, 89);
  ctx.fillStyle = '#c1a25a';
  ctx.fillRect(0, 179, WIDTH, 5);
  ctx.fillRect(0, 956, WIDTH, 5);
  ctx.strokeStyle = '#d2decf';
  ctx.lineWidth = 1;
  ctx.strokeRect(29, 209, WIDTH - 58, 717);
  for (const [origin, sign] of [[51, 1], [WIDTH - 51, -1]]) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = '#e6dfb1';
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 3; row += 1) {
        const x = origin + sign * (column * 36 + (row % 2) * 18);
        const y = 28 + row * 54;
        ctx.beginPath();
        for (let i = 0; i < 6; i += 1) {
          const angle = Math.PI / 3 * i;
          const px = x + Math.cos(angle) * 28;
          const py = y + Math.sin(angle) * 28;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  // Small, quiet corner brackets establish a distinct school template.
  for (const [x, y, dx, dy] of [[47, 226, 1, 1], [WIDTH - 47, 226, -1, 1], [47, 909, 1, -1], [WIDTH - 47, 909, -1, -1]]) {
    line(ctx, x, y, x + 50 * dx, y, '#b89a52', 2);
    line(ctx, x, y, x, y + 50 * dy, '#b89a52', 2);
  }
}

function medal(ctx, x, y, kind, school) {
  ctx.save();
  // Ribbon ends are behind the rosette and never resemble an official seal.
  ctx.fillStyle = school ? '#315a46' : '#b79a53';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + side * 6, y + 34);
    ctx.lineTo(x + side * 30, y + 88);
    ctx.lineTo(x + side * 45, y + 72);
    ctx.lineTo(x + side * 59, y + 78);
    ctx.lineTo(x + side * 35, y + 27);
    ctx.closePath();
    ctx.fill();
  }
  const gold = ctx.createLinearGradient(x - 63, y - 63, x + 63, y + 63);
  gold.addColorStop(0, '#ecd591');
  gold.addColorStop(0.38, '#b08b39');
  gold.addColorStop(0.7, '#f1db9b');
  gold.addColorStop(1, '#9b7426');
  polygon(ctx, x, y, 66, 60, 24, gold);
  ctx.fillStyle = '#fff9e8';
  ctx.beginPath();
  ctx.arc(x, y, 51, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c1a056';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 45, 0, Math.PI * 2);
  ctx.stroke();
  if (kind === 'laurel') {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i += 1) {
        const angle = (0.1 + i * 0.27) * side;
        const px = x + Math.sin(angle) * 34;
        const py = y + 14 + Math.cos(angle) * 11 - i * 8;
        leaf(ctx, px, py, side < 0 ? -2.3 : -0.84, 13, '#a5873d');
      }
    }
    polygon(ctx, x, y - 17, 12, 5, 5, '#a98536');
  } else polygon(ctx, x, y - 14, 20, 9, 5, '#a98536');
  label(ctx, kind === 'laurel' ? 'إنجاز' : 'تميّز', x, y + 28, 21, 800, '#7b6129');
  ctx.restore();
}

function flourish(ctx, y, school) {
  const gradient = ctx.createLinearGradient(CENTER - 240, y, CENTER + 240, y);
  gradient.addColorStop(0, '#d8c79c00');
  gradient.addColorStop(0.35, school ? '#b49b59' : '#b79245');
  gradient.addColorStop(0.65, school ? '#b49b59' : '#b79245');
  gradient.addColorStop(1, '#d8c79c00');
  line(ctx, CENTER - 240, y, CENTER - 20, y, gradient, 1.3);
  line(ctx, CENTER + 20, y, CENTER + 240, y, gradient, 1.3);
  polygon(ctx, CENTER, y, 9, 3.2, 4, '#b18e42');
  polygon(ctx, CENTER - 22, y, 3, 1.4, 4, '#c2a66c');
  polygon(ctx, CENTER + 22, y, 3, 1.4, 4, '#c2a66c');
}

function recipient(ctx, name) {
  const value = name || 'لصاحب هذا الإنجاز';
  ctx.font = `800 58px ${FONT}`;
  if (ctx.measureText(value).width <= 1050 || !value.includes(' ')) {
    fitted(ctx, value, CENTER, 510, 1050, 58, 28, 800);
    return;
  }
  // Balance a long Arabic name into two complete lines; no name is ellipsized.
  const words = value.split(/\s+/);
  let split = 1;
  let best = Infinity;
  for (let i = 1; i < words.length; i += 1) {
    const first = ctx.measureText(words.slice(0, i).join(' ')).width;
    const second = ctx.measureText(words.slice(i).join(' ')).width;
    if (Math.max(first, second) < best) { best = Math.max(first, second); split = i; }
  }
  fitted(ctx, words.slice(0, split).join(' '), CENTER, 480, 1070, 45, 25, 800);
  fitted(ctx, words.slice(split).join(' '), CENTER, 533, 1070, 45, 25, 800);
}

function evidence(ctx, facts, school) {
  if (!facts.length) {
    label(ctx, 'اختر إنجازًا موثّقًا لإكمال الشهادة', CENTER, 679, 26, 500, MUTED);
    return;
  }
  label(ctx, 'تقديرًا للجهد والإنجاز الموثّق في سجل التعلّم', CENTER, 620, 23, 500, MUTED);
  if (facts.length > 1) line(ctx, CENTER, 650, CENTER, 756, school ? '#d7dfd6' : '#dfd0aa', 1);
  facts.forEach((fact, index) => {
    const x = facts.length === 1 ? CENTER : CENTER + (index === 0 ? 270 : -270);
    const width = facts.length === 1 ? 970 : 464;
    const heading = `${fact.count}  ·  ${fact.title}`;
    fitted(ctx, heading, x, 679, width, 31, 19, 700, school ? '#28543f' : '#997125');
    wrapped(ctx, fact.scope, x, 715, width, 19, 26, MUTED, 2);
  });
}

function signatures(ctx, meta) {
  const entries = [
    { name: meta.teacherName, caption: meta.teacherLabel, x: CENTER + 335 },
    { name: meta.principalName, caption: meta.principalLabel, x: CENTER - 335 },
  ].filter(entry => entry.name);
  if (entries.length === 1) entries[0].x = CENTER;
  entries.forEach(entry => {
    label(ctx, entry.caption, entry.x, 851, 20, 500, MUTED);
    fitted(ctx, entry.name, entry.x, 891, 450, 27, 17, 700);
    line(ctx, entry.x - 145, 910, entry.x + 145, 910, '#c9bb98', 1);
  });
}

/** Paint only certificate fields and the allowlisted achievementCard evidence. */
export function drawCertificateDesign(canvas, card = {}, options = {}) {
  const meta = certificateMetadata(options);
  const name = plain(card.name, 240);
  const facts = (Array.isArray(card.evidence) ? card.evidence : [])
    .filter(fact => fact && (fact.key === 'participation' || fact.key === 'scores'))
    .slice(0, 2)
    .map(fact => ({ count: plain(fact.count, 14), title: plain(fact.title, 100), scope: plain(fact.scope, 240) }));
  const demo = card.demo === true;
  const school = meta.design === 'school';
  canvas.width = WIDTH * 2;
  canvas.height = HEIGHT * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  ctx.scale(2, 2);
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (school) schoolBackground(ctx); else ornateBackground(ctx);

  const headerColor = school ? '#fffdf2' : INK;
  const secondaryColor = school ? '#d6e3cf' : '#8c805f';
  fitted(ctx, meta.schoolName || 'رَكيز المعلم', CENTER, school ? 85 : 114, 960, 29, 20, 700, headerColor);
  fitted(ctx, meta.educationDepartment || 'نحتفي بالتعلّم، ونقدّر الإنجاز', CENTER, school ? 124 : 148, 960, 19, 15, 500, secondaryColor);

  medal(ctx, school ? WIDTH - 191 : 191, 277, meta.medal, school);
  label(ctx, 'للجهد قيمة، وللإنجاز تقدير', CENTER, 245, 20, 500, school ? '#8b8a71' : '#9a8558');
  fitted(ctx, 'شهادة شكر وتقدير', CENTER, 330, 1010, 78, 54, 800, school ? '#244c3a' : '#9e792f');
  flourish(ctx, 372, school);
  label(ctx, name ? 'تُمنح هذه الشهادة بكل تقدير إلى' : 'نحتفي بصاحب هذا الإنجاز', CENTER, 427, 24, 500, MUTED);
  recipient(ctx, name);

  const contextLine = [meta.className, meta.subjectName].filter(Boolean).join('  ·  ');
  if (contextLine) fitted(ctx, contextLine, CENTER, 569, 1050, 23, 16, 600, school ? '#5c7860' : '#9b8553');
  evidence(ctx, facts, school);
  label(ctx, 'شكرًا لكل خطوة نحو التعلّم، ومزيدًا من النجاح', CENTER, 800, 22, 500, INK);
  signatures(ctx, meta);

  if (school) {
    fitted(ctx, meta.dateLabel || 'شهادة تقدير · رَكيز المعلم', CENTER, 995, 1160, 18, 14, 500, '#edf0dc');
    label(ctx, demo ? 'بيانات تجريبية · رَكيز المعلم' : 'رَكيز المعلم | ركيزة المعلم الرقمية', CENTER, 1024, 16, 500, '#c5d5bd');
  } else {
    line(ctx, 290, 946, WIDTH - 290, 946, '#dfd1ad', 1);
    fitted(ctx, meta.dateLabel || 'شهادة تقدير · رَكيز المعلم', CENTER, 970, 1100, 18, 14, 500, '#8e835f');
    label(ctx, demo ? 'بيانات تجريبية · رَكيز المعلم' : 'رَكيز المعلم | ركيزة المعلم الرقمية', CENTER, 993, 16, 500, '#9a8e6d');
  }
  if (demo) {
    // A visible label survives export even when the name is hidden.
    ctx.save();
    ctx.fillStyle = school ? '#fffaf0' : '#f6eacf';
    ctx.fillRect(CENTER - 83, 188, 166, 28);
    label(ctx, 'بيانات تجريبية', CENTER, 208, 16, 700, '#816328');
    ctx.restore();
  }
  return canvas;
}
