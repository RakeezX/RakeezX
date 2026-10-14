"""Inspect and render actual app PDFs, with browser decoration explicitly enabled."""
import json, logging, unicodedata, sys
from pathlib import Path
import pdfplumber
import pypdfium2 as pdfium
from pypdf import PdfReader
from PIL import Image, ImageDraw
logging.getLogger('pdfminer').setLevel(logging.ERROR)
root=Path('test-results/n24-clean')
results={}
for phase in ['before','zero-margin-failed','after']:
    for file in sorted((root/(phase+'-chromium')).glob('*.pdf')):
        geometry=[]
        with pdfplumber.open(file) as pdf:
            for i,page in enumerate(pdf.pages):
                words=page.extract_words()
                text=unicodedata.normalize('NFKC',page.extract_text() or '')
                sentinels=[s for s in ['N24_TITLE_SENTINEL','N24_DATE_SENTINEL','N24_URL_SENTINEL'] if s in text]
                # Browser decorations are deliberately retained and reported in
                # the fallback candidate. Assess application content separately.
                content=[w for w in words if w['top']>25 and w['bottom']<page.height-25]
                bounds=[min(w['x0'] for w in content),min(w['top'] for w in content),max(w['x1'] for w in content),max(w['bottom'] for w in content)]
                geometry.append(dict(page=i+1,bounds=bounds,sentinels=sentinels,words=len(words)))
                if phase=='after':
                    margin=22 if page.width>page.height else 28
                    assert bounds[0]>=margin-1 and bounds[1]>=margin-1 and bounds[2]<=page.width-margin+1 and bounds[3]<=page.height-margin+1,(file,i,bounds,page.width,page.height)
                    # Continued table headings, not an isolated signatures page.
                    assert ('الطالب' in text or 'بلاطلا' in text) if file.stem!='execution' else ('التاريخ' in text or 'خيراتلا' in text),(file,i,'missing table heading')
        links=[a.get_object().get('/A',{}).get('/URI') for p in PdfReader(file).pages for a in p.get('/Annots',[])]
        if phase=='after':assert links.count('https://rakeezx.com/')>=2,(file,links)
        results[phase+'/'+file.stem]={'pages':len(geometry),'geometry':geometry,'rootLinks':links.count('https://rakeezx.com/'),'browserDecorationSuppressed':not any(p['sentinels'] for p in geometry)}
        doc=pdfium.PdfDocument(file)
        indices=sorted(set([0,len(doc)//2,len(doc)-1]))
        thumbs=[]
        for i in indices:
            image=doc[i].render(scale=1.5).to_pil();image.save(file.with_suffix('').as_posix()+f'-page-{i+1}.png')
            image.thumbnail((680,900));thumbs.append((i,image.copy()))
        sheet=Image.new('RGB',(700*len(thumbs),950),'#ddd');draw=ImageDraw.Draw(sheet)
        for n,(i,img) in enumerate(thumbs):sheet.paste(img,(700*n+(700-img.width)//2,35));draw.text((700*n+10,10),f'{phase}/{file.stem} page {i+1}',fill='black')
        sheet.save(file.with_suffix('').as_posix()+'-qa.png')
        print(phase,file.stem,len(geometry),'pages',geometry[0],geometry[-1])
(root/'pdf-proof.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
if any(not proof['browserDecorationSuppressed'] for name,proof in results.items() if name.startswith('after/')):
    print('FAIL browser decoration suppression: enabled-template sentinels remain; candidate preserves original page margins.')
    sys.exit(1)
