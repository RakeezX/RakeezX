const encoder = new TextEncoder();
const A4_WIDTH = 841.889764;
const A4_HEIGHT = 595.275591;

/** A single image on a single A4 landscape page. No text, links or remote assets. */
export function certificatePdfFromJpeg(jpeg, width, height) {
  if (!(jpeg instanceof Uint8Array) || jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8
    || jpeg.at(-2) !== 0xff || jpeg.at(-1) !== 0xd9) throw new Error('Certificate JPEG is unavailable');
  if (![width, height].every(value => Number.isSafeInteger(value) && value > 0 && value <= 32768)) {
    throw new Error('Certificate dimensions are invalid');
  }
  const parts = [];
  const offsets = [0];
  let length = 0;
  const append = value => {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    parts.push(bytes); length += bytes.byteLength;
  };
  const object = (id, value) => { offsets[id] = length; append(`${id} 0 obj\n${value}\nendobj\n`); };
  append('%PDF-1.4\n%');
  append(new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH} ${A4_HEIGHT}] /Resources << /XObject << /Certificate 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = length;
  append(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.byteLength} >>\nstream\n`);
  append(jpeg);
  append('\nendstream\nendobj\n');
  // Fit without distorting the original canvas, even if its dimensions change later.
  const scale = Math.min(A4_WIDTH / width, A4_HEIGHT / height);
  const paintedWidth = Number((width * scale).toFixed(6));
  const paintedHeight = Number((height * scale).toFixed(6));
  const x = Number(((A4_WIDTH - paintedWidth) / 2).toFixed(6));
  const y = Number(((A4_HEIGHT - paintedHeight) / 2).toFixed(6));
  const content = `q\n${paintedWidth} 0 0 ${paintedHeight} ${x} ${y} cm\n/Certificate Do\nQ\n`;
  object(5, `<< /Length ${encoder.encode(content).byteLength} >>\nstream\n${content}endstream`);
  const xref = length;
  append('xref\n0 6\n0000000000 65535 f \n');
  for (const offset of offsets.slice(1)) append(`${String(offset).padStart(10, '0')} 00000 n \n`);
  append(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
