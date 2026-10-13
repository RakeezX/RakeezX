"""Inspect app-generated PDFs, render with existing Poppler, and assemble QA sheets.
No report content is authored here; PDF pages come from Chromium's app print path.
"""
import json
import logging
import subprocess
import sys
import unicodedata
from pathlib import Path
import pdfplumber
from PIL import Image, ImageDraw

root = Path('test-results/n24')
renderer = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe'
only = sys.argv[1] if len(sys.argv)>1 else None
summary = json.loads((root/'pdf-geometry.json').read_text(encoding='utf-8')) if only else {}
logging.getLogger('pdfminer').setLevel(logging.ERROR)
for phase in ['before', 'after']:
    for file in sorted((root / phase).glob('*.pdf')):
        if only and (phase != 'after' or not file.stem.endswith('-'+only)): continue
        pages = []
        with pdfplumber.open(file) as pdf:
            for index, page in enumerate(pdf.pages):
                words = page.extract_words()
                # Actual PDF text geometry, in addition to visual page inspection.
                assert words, f'{file} page {index+1} is empty'
                outside = [w for w in words if not (0 <= w['x0'] <= w['x1'] <= page.width + 1 and 0 <= w['top'] < w['bottom'] <= page.height + 1)]
                if phase == 'after': assert not outside, f'{file} page {index+1} text outside paper: {outside[:3]}'
                text = unicodedata.normalize('NFKC',page.extract_text())
                if phase == 'after' and 'execution' not in file.stem:
                    assert 'الطالب' in text or 'بلاطلا' in text, f'{file} page {index+1} missing repeated table heading or isolated closing page'
                pages.append({'width':page.width,'height':page.height,'words':len(words),
                              'outside':outside,
                              'text':page.extract_text()})
        summary[f'{phase}/{file.stem}'] = pages
        # Render every final page and the small before documents for comparison.
        if phase == 'after' or file.stem.startswith('small-'):
            subprocess.run([str(renderer), '-scale-to', '1400', '-png', str(file), str(file.with_suffix(''))+'-render'], check=True, capture_output=True)

for surface in ['grades','roster','attendance','detailed','support','execution','cross-grades','cross-followup']:
    if only and surface != only: continue
    images = [root/'before'/f'small-{surface}-render-1.png', root/'after'/f'small-{surface}-render-1.png']
    count=len(summary[f'after/multi-{surface}'])
    images += [root/'after'/f'multi-{surface}-render-{str(i).zfill(len(str(count)))}.png' for i in range(1,count+1)]
    for chunk in range(0,len(images),6):
        group = images[chunk:chunk+6]
        sheet = Image.new('RGB',(1800, 900*((len(group)+2)//3)), '#e1e6e4')
        draw=ImageDraw.Draw(sheet)
        for index, file in enumerate(group):
            image=Image.open(file);image.thumbnail((580,850))
            x=(index%3)*600+(600-image.width)//2;y=(index//3)*900+32
            sheet.paste(image,(x,y));draw.text(((index%3)*600+12,(index//3)*900+10),f'{file.parent.name}/{file.stem}',fill='black')
        sheet.save(root/f'qa-{surface}-{chunk//6+1}.png')
(root/'pdf-geometry.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
for key,pages in summary.items():
    print(key,len(pages),'pages',[(p['words']) for p in pages])
