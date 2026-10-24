/** Original certificate artwork. All data is an explicit, local display projection. */

export const CERTIFICATE_DESIGNS = Object.freeze([
  Object.freeze({ id: 'ornate', label: 'ذهبي إسلامي', description: 'نجوم ثمانية وزخارف هندسية ذهبية على ورق عاجي' }),
  Object.freeze({ id: 'school', label: 'أخضر مدرسي', description: 'تصميم مدرسي أنيق بألوان ركيز' }),
]);

export const CERTIFICATE_MEDALS = Object.freeze([
  Object.freeze({ id: 'star', label: 'تميّز' }),
]);

export const CERTIFICATE_TEXT_LIMIT = 600;
export const HEADER_FONT_FAMILY = 'Rakeez Certificate Header';

const WIDTH = 1485;
const HEIGHT = 1050;
const CENTER = WIDTH / 2;
const FONT = '"Tajawal", sans-serif';
const HEADER_FONT = `"${HEADER_FONT_FAMILY}", "Noto Naskh Arabic", serif`;
const INK = '#243e35';
const GOLD = '#a77b2e';
const MUTED = '#767768';

function plain(value, limit) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return Array.from(String(value)
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ').trim()).slice(0, limit).join('');
}

/** Teacher-written copy stays plain text; intentional line breaks are retained. */
export function certificateText(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.replace(/\r\n?|\u2028|\u2029/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .split('\n').map(part => part.replace(/\s+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
  return Array.from(normalized).slice(0, CERTIFICATE_TEXT_LIMIT).join('').trim();
}

export function defaultCertificateText() {
  return 'تقديرًا لجهوده المتميزة، واجتهاده ومثابرته في طلب العلم، وتشجيعًا له على مواصلة مسيرة التميّز والإبداع، سائلين الله له دوام التوفيق والسداد';
}

/** Do not pass a full profile to the painter: keep certificate identity deliberately narrow. */
export function certificateMetadata(input = {}) {
  input = input && typeof input === 'object' ? input : {};
  return Object.freeze({
    design: CERTIFICATE_DESIGNS.some(item => item.id === input.design) ? input.design : 'ornate',
    medal: 'star',
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

function label(ctx, value, x, y, size, weight = 500, color = INK, width, family = FONT) {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  if (width) ctx.fillText(String(value), x, y, width);
  else ctx.fillText(String(value), x, y);
}

function fitted(ctx, value, x, y, width, size, minSize = 16, weight = 700, color = INK, family = FONT) {
  const text = String(value);
  let used = size;
  for (; used > minSize; used -= 1) {
    ctx.font = `${weight} ${used}px ${family}`;
    if (ctx.measureText(text).width <= width) break;
  }
  label(ctx, text, x, y, used, weight, color, width, family);
}

function textLines(ctx, value, width) {
  const lines = [];
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ar', { granularity: 'grapheme' }) : null;
  for (const paragraph of value.split('\n')) {
    if (!paragraph) { lines.push(''); continue; }
    let current = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= width) { current = candidate; continue; }
      if (current) { lines.push(current); current = ''; }
      if (ctx.measureText(word).width <= width) { current = word; continue; }
      // Split an unusually long token by grapheme, never in the middle of an
      // Arabic combining mark or emoji sequence, and keep every character.
      const parts = segmenter ? [...segmenter.segment(word)].map(part => part.segment) : Array.from(word);
      for (const part of parts) {
        if (current && ctx.measureText(current + part).width > width) { lines.push(current); current = ''; }
        current += part;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
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

function eightPointStar(ctx, x, y, radius, fill = '#fff8e8', stroke = '#b18b42', width = 1.2) {
  // The inner radius is the intersection of two squares rotated by 45 degrees.
  polygon(ctx, x, y, radius, radius * Math.SQRT1_2 / Math.cos(Math.PI / 8), 8, fill);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Original eight-point geometry and angular ribbons, reflected at all four corners. */
function geometricCorner(ctx, x, y, directionX, directionY) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(directionX, directionY);
  ctx.lineJoin = 'miter';

  // Parallel, bevelled corner bands connect the horizontal and vertical pattern.
  for (const inset of [6, 17]) {
    ctx.strokeStyle = inset === 6 ? '#b18b42' : '#d7bf81';
    ctx.lineWidth = inset === 6 ? 2 : 1.1;
    ctx.beginPath();
    ctx.moveTo(inset, 183);
    ctx.lineTo(inset, 98);
    ctx.lineTo(98, inset);
    ctx.lineTo(183, inset);
    ctx.stroke();
  }

  for (const vertical of [false, true]) {
    ctx.save();
    if (vertical) { ctx.rotate(Math.PI / 2); ctx.scale(1, -1); }
    ctx.strokeStyle = '#c1a25d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(80, 31);
    ctx.lineTo(97, 31);
    ctx.lineTo(115, 13);
    ctx.lineTo(133, 31);
    ctx.lineTo(151, 31);
    ctx.lineTo(165, 17);
    ctx.lineTo(179, 31);
    ctx.lineTo(190, 31);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(80, 31);
    ctx.lineTo(97, 31);
    ctx.lineTo(115, 49);
    ctx.lineTo(133, 31);
    ctx.lineTo(151, 31);
    ctx.lineTo(165, 45);
    ctx.lineTo(179, 31);
    ctx.lineTo(190, 31);
    ctx.stroke();
    eightPointStar(ctx, 115, 31, 13, '#fbf3df', '#b99650', 1.1);
    eightPointStar(ctx, 165, 31, 9, '#fffaf0', '#c1a46a', 0.9);
    polygon(ctx, 115, 31, 4.5, 4.5, 4, '#bd9b53');
    polygon(ctx, 165, 31, 2.5, 2.5, 4, '#c4aa70');
    ctx.restore();
  }

  eightPointStar(ctx, 46, 46, 41, '#eee0bb', '#af873b', 1.7);
  eightPointStar(ctx, 46, 46, 34, '#fffaf0', '#c5a764', 0.9);
  // The two nested square ribbons are the central interlaced geometric knot.
  for (const rotation of [0, Math.PI / 4]) {
    ctx.save();
    ctx.translate(46, 46);
    ctx.rotate(rotation);
    ctx.strokeStyle = '#b18d45';
    ctx.lineWidth = 3.1;
    ctx.strokeRect(-18.5, -18.5, 37, 37);
    ctx.strokeStyle = '#fff8e7';
    ctx.lineWidth = 1;
    ctx.strokeRect(-18.5, -18.5, 37, 37);
    ctx.restore();
  }
  eightPointStar(ctx, 46, 46, 10.5, '#bc9951', '#a9863f', 0.7);
  polygon(ctx, 46, 46, 3.2, 3.2, 4, '#fff8e8');
  ctx.restore();
}

/** Fine angular interlace around the four straight edges. */
function angularBorder(ctx, x, y, length, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  const count = Math.floor(length / 24);
  const offset = (length - count * 24) / 2;
  ctx.strokeStyle = '#b99a57';
  ctx.lineWidth = 0.95;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    for (let i = 0; i < count; i += 1) {
      const at = offset + i * 24;
      ctx.lineTo(at + 6, 4 * side);
      ctx.lineTo(at + 12, 0);
      ctx.lineTo(at + 18, -4 * side);
      ctx.lineTo(at + 24, 0);
    }
    ctx.stroke();
  }
  // Alternate crossings leave a small ivory gap, making the over-under weave legible.
  for (let i = 1; i < count * 2; i += 2) {
    const at = offset + i * 12;
    line(ctx, at - 2.2, -1.47, at + 2.2, 1.47, '#fcf5e4', 2.5);
    line(ctx, at - 2.2, -1.47, at + 2.2, 1.47, '#b99a57', 0.95);
  }
  ctx.restore();
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
  angularBorder(ctx, 255, 43, WIDTH - 510);
  angularBorder(ctx, 255, HEIGHT - 43, WIDTH - 510);
  angularBorder(ctx, 43, 255, HEIGHT - 510, Math.PI / 2);
  angularBorder(ctx, WIDTH - 43, 255, HEIGHT - 510, Math.PI / 2);
  for (const [x, y, dx, dy] of [[62, 62, 1, 1], [WIDTH - 62, 62, -1, 1], [62, HEIGHT - 62, 1, -1], [WIDTH - 62, HEIGHT - 62, -1, -1]]) geometricCorner(ctx, x, y, dx, dy);
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

function medal(ctx, x, y, school) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.18, 1.18);
  x = 0;
  y = 0;
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
  polygon(ctx, x, y - 14, 20, 9, 5, '#a98536');
  label(ctx, 'تميّز', x, y + 28, 21, 800, '#7b6129');
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
  const value = name || 'اسم الطالب';
  ctx.font = `800 58px ${FONT}`;
  if (ctx.measureText(value).width <= 1050 || !value.includes(' ')) {
    fitted(ctx, value, CENTER, 484, 1050, 58, 28, 800);
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
  fitted(ctx, words.slice(0, split).join(' '), CENTER, 455, 1070, 45, 25, 800);
  fitted(ctx, words.slice(split).join(' '), CENTER, 507, 1070, 45, 25, 800);
}

function appreciation(ctx, text) {
  if (!text) {
    label(ctx, 'اكتب نص الشهادة لمعاينته هنا', CENTER, 672, 25, 500, MUTED);
    return;
  }
  const width = 1050;
  const top = 582;
  const height = 170;
  const leading = 1.38;
  const layout = value => {
    let lines = [];
    let size = 29;
    for (; size >= 12; size -= 1) {
      ctx.font = `500 ${size}px ${FONT}`;
      lines = textLines(ctx, value, width);
      if (lines.length * size * leading <= height) return { lines, size };
    }
    return { lines, size: 12 };
  };
  let fittedText = layout(text);
  // Keep the author's line breaks when they fit. Excessive hard breaks are
  // reflowed instead of dropping copy or letting it overlap the signatures.
  if (fittedText.lines.length * fittedText.size * leading > height) {
    fittedText = layout(text.replace(/\n+/g, ' '));
  }
  const size = Math.min(fittedText.size, height / (fittedText.lines.length * leading));
  const lineHeight = size * leading;
  const firstBaseline = top + (height - fittedText.lines.length * lineHeight) / 2 + lineHeight * 0.76;
  fittedText.lines.forEach((value, index) => label(ctx, value, CENTER, firstBaseline + index * lineHeight, size, 500, INK, width));
}

function signatures(ctx, meta) {
  const entries = [
    { name: meta.teacherName, caption: meta.teacherLabel, x: CENTER + 335 },
    { name: meta.principalName, caption: meta.principalLabel, x: CENTER - 335 },
  ].filter(entry => entry.name);
  if (entries.length === 1) entries[0].x = CENTER;
  entries.forEach(entry => {
    label(ctx, entry.caption, entry.x, 813, 20, 500, MUTED);
    fitted(ctx, entry.name, entry.x, 854, 450, 27, 17, 700);
    line(ctx, entry.x - 145, 876, entry.x + 145, 876, '#c9bb98', 1);
  });
}

function ministryMark(ctx, image, school) {
  if (!image) return;
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!(sourceWidth > 0 && sourceHeight > 0)) throw new Error('Ministry logo is unavailable');
  const width = 168;
  const height = width * sourceHeight / sourceWidth;
  const x = CENTER - width / 2;
  const y = school ? 24 : 66;
  ctx.save();
  if (school) {
    // Preserve the original green/teal mark against the dark school header.
    ctx.fillStyle = '#fffdf7';
    ctx.beginPath();
    ctx.roundRect(x - 13, y - 9, width + 26, height + 18, 10);
    ctx.fill();
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, x, y, width, height);
  ctx.restore();
}

/** Balanced identity blocks leave the centered Ministry mark unobstructed. */
function headerIdentity(ctx, value, x, school, size, color) {
  if (!value) return;
  const width = 350;
  const top = school ? 38 : 78;
  const height = 104;
  let lines = [];
  for (; size >= 16; size -= 1) {
    ctx.font = `700 ${size}px ${HEADER_FONT}`;
    lines = textLines(ctx, value, width);
    if (lines.length * size * 1.25 <= height) break;
  }
  const lineHeight = size * 1.25;
  const firstBaseline = top + (height - lines.length * lineHeight) / 2 + lineHeight * 0.76;
  lines.forEach((text, index) => label(ctx, text, x, firstBaseline + index * lineHeight, size, 700, color, width, HEADER_FONT));
}

/** The complete approved Thuluth phrase stays identical on every device/export. */
function titleArtwork(ctx, image) {
  const width = image?.naturalWidth || image?.width;
  const height = image?.naturalHeight || image?.height;
  if (!(width > 0 && height > 0)) throw new Error('Certificate title artwork is unavailable');
  const scale = Math.min(900 / width, 142 / height);
  const drawnWidth = width * scale;
  const drawnHeight = height * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, CENTER - drawnWidth / 2, 282 - drawnHeight / 2, drawnWidth, drawnHeight);
}

/** Paint only certificate identity and the teacher's explicit appreciation text. */
export function drawCertificateDesign(canvas, card = {}, options = {}) {
  const meta = certificateMetadata(options);
  const name = plain(card.name, 240);
  const text = certificateText(card.text);
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

  ministryMark(ctx, options.ministryLogo, school);

  // Give both institutions equal visual weight, with a palette chosen for each
  // certificate. Physical placement follows the Arabic reading order.
  const headerColor = school ? '#fff0ce' : '#705126';
  headerIdentity(ctx, meta.educationDepartment, CENTER + 312.5, school, 32, headerColor);
  headerIdentity(ctx, meta.schoolName || 'رَكيز المعلم', CENTER - 312.5, school, 32, headerColor);

  medal(ctx, school ? WIDTH - 191 : 191, 292, school);
  titleArtwork(ctx, options.titleArtwork);
  flourish(ctx, 361, school);
  label(ctx, 'تمنح هذه الشهادة بكل تقدير إلى الطالب', CENTER, 404, 24, 500, MUTED);
  recipient(ctx, name);

  const contextLine = [meta.className, meta.subjectName].filter(Boolean).join('  ·  ');
  if (contextLine) fitted(ctx, contextLine, CENTER, 548, 1050, 23, 16, 600, school ? '#5c7860' : '#9b8553');
  appreciation(ctx, text);
  signatures(ctx, meta);

  if (school) {
    fitted(ctx, meta.dateLabel || 'شهادة تقدير · رَكيز المعلم', CENTER, 995, 1160, 18, 14, 500, '#edf0dc');
    label(ctx, demo ? 'بيانات تجريبية · رَكيز المعلم' : 'رَكيز المعلم | ركيزة المعلم الرقمية', CENTER, 1024, 16, 500, '#c5d5bd');
  } else {
    line(ctx, 290, 946, WIDTH - 290, 946, '#dfd1ad', 1);
    fitted(ctx, meta.dateLabel || 'شهادة تقدير · رَكيز المعلم', CENTER, 970, 960, 18, 14, 500, '#8e835f');
    label(ctx, demo ? 'بيانات تجريبية · رَكيز المعلم' : 'رَكيز المعلم | ركيزة المعلم الرقمية', CENTER, 993, 16, 500, '#9a8e6d');
  }
  if (demo) {
    // A visible label survives every certificate export.
    ctx.save();
    ctx.fillStyle = school ? '#fffaf0' : '#f6eacf';
    ctx.fillRect(CENTER - 83, 909, 166, 25);
    label(ctx, 'بيانات تجريبية', CENTER, 927, 16, 700, '#816328');
    ctx.restore();
  }
  return canvas;
}
