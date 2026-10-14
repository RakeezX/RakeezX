"""Calibrated enabled-decoration proof and per-page actual application geometry."""
import json,logging,re,unicodedata,sys
from pathlib import Path
import pdfplumber
import pypdfium2 as pdfium
from pypdf import PdfReader
from PIL import Image,ImageDraw
logging.getLogger('pdfminer').setLevel(logging.ERROR)
root=Path('test-results/n24-native');metadata='--metadata' in sys.argv
proof=json.loads((root/'proof.json').read_text(encoding='utf-8')) if metadata else {}
for phase in ['metadata'] if metadata else ['control','candidate']:
 for file in sorted((root/phase).glob('*.pdf')):
  pages=[];native=file.stem.endswith('-native') or phase=='metadata';surface=re.sub(r'-(320|390)$','',file.stem.removesuffix('-native'))
  with pdfplumber.open(file) as doc:
   for index,page in enumerate(doc.pages):
    text=unicodedata.normalize('NFKC',page.extract_text() or '')
    sentinels=[s for s in ['N24_TITLE_SENTINEL','N24_URL_SENTINEL','N24_DATE_SENTINEL'] if s in text]
    words=page.extract_words();assert words,(file,index,'empty page')
    # Default native date is not programmable. Check the calibrated native
    # numeric date and the complete browser-decoration bands independently.
    default_dates=re.findall(r'\b\d{1,2}/\d{1,2}/\d{2,4}\b',text)
    if phase=='control':
     assert all(s in sentinels for s in ['N24_TITLE_SENTINEL','N24_URL_SENTINEL']+([] if native else ['N24_DATE_SENTINEL'])),(file,index,sentinels)
     if native:assert default_dates,(file,index,'native date control missing')
    else:
     assert not sentinels and not default_dates,(file,index,sentinels,default_dates)
     # Include EVERY word, rather than filtering out unsafe edge content.
     margin=22 if page.width>page.height else 28 # >7.7/9.8mm printer-safe text
     assert all(margin<=w['x0']<=w['x1']<=page.width-margin and margin<=w['top']<w['bottom']<=page.height-margin for w in words),(file,index,'text outside safe margins')
     # Check painted table borders too, not just text baselines.
     # The existing white paper background spans the sheet; it is not a
     # printable table border. Inspect every non-white fill or stroked shape.
     painted=[r for r in page.rects+page.lines if (r.get('stroke') and r.get('stroking_color') not in [(1,1,1),1]) or (r.get('fill') and r.get('non_stroking_color') not in [(1,1,1),1])]
     assert all(margin<=r['x0']<=r['x1']<=page.width-margin and margin<=r['top']<=r['bottom']<=page.height-margin for r in painted),(file,index,'painted table/header/footer outside safe margins')
     assert ('التاريخ' in text or 'خيراتلا' in text) if surface=='execution' else ('الطالب' in text or 'بلاطلا' in text),(file,index,'missing repeated heading')
    pages.append({'page':index+1,'sentinels':sentinels,'defaultDates':default_dates,'bounds':[min(w['x0'] for w in words),min(w['top'] for w in words),max(w['x1'] for w in words),max(w['bottom'] for w in words)],'words':len(words)})
  links=[a.get_object().get('/A',{}).get('/URI') for p in PdfReader(file).pages for a in p.get('/Annots',[])]
  if phase!='control':assert links.count('https://rakeezx.com/')>=2,(file,links)
  proof[phase+'/'+file.stem]={'pages':pages,'rootLinks':links.count('https://rakeezx.com/')}
  # The browser-native path gets an independent all-page check above; render
  # first/middle/last of the marked default-convention path for visual QA.
  if not native:
   doc=pdfium.PdfDocument(file);indices=sorted(set([0,len(doc)//2,len(doc)-1]))
   sheet=Image.new('RGB',(700*len(indices),950),'#ddd');draw=ImageDraw.Draw(sheet)
   for n,i in enumerate(indices):
    image=doc[i].render(scale=1.5).to_pil();image.save(file.with_suffix('').as_posix()+f'-page-{i+1}.png');image.thumbnail((680,900));sheet.paste(image,(700*n+(700-image.width)//2,35));draw.text((700*n+10,10),f'{phase}/{file.stem} page {i+1}',fill='black')
   sheet.save(file.with_suffix('').as_posix()+'-qa.png')
  print('PASS',phase,file.name,len(pages),'pages; all-page calibration/suppression and candidate margins/headers/links')
(root/'proof.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2),encoding='utf-8')
