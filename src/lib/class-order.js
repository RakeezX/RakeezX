// AI: comparison only. Never use these keys for identity, matching or persistence.
const natural = new Intl.Collator('ar', {numeric:true, sensitivity:'base'});
const normalize = value => String(value ?? '').normalize('NFC')
 .replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
 .replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
 .replace(/[إأآٱ]/g,'ا').replace(/[\u0640\u064B-\u065F\u0670]/g,'').trim().replace(/\s+/g,' ');
const ordinals = [['اول','اولي','اولى'],['ثان','ثاني','ثانيه','ثانية'],['ثالث','ثالثه','ثالثة'],['رابع','رابعه','رابعة'],['خامس','خامسه','خامسة'],['سادس','سادسه','سادسة']];
function parsed(value) {
 const text=normalize(value).replace(/^الصف\s+/,'').replace(/^ال/, '');
 const match=text.match(/^([^\d\s/]+)(.*)$/u);
 if(!match)return null;
 const ordinal=ordinals.findIndex(words=>words.includes(match[1]))+1;
 if(!ordinal)return null;
 let rest=match[2].trim(),offset=0;
 const stage=rest.match(/^(?:ال)?(ابتدائي|ابتدائية|ابتدايي|متوسط|متوسطة|ثانوي|ثانوية)(?=\s|\d|\/|$)/);
 if(stage){offset=stage[1].startsWith('متوسط')?6:stage[1].startsWith('ثانو')?9:0;rest=rest.slice(stage[0].length).trim();}
 if(offset&&ordinal>3)return null;
 // Unrecognized trailing words cannot silently supply a grade.
 if(rest&&!/^(?:[/ -]\s*)?(?:\d+|[ابجدهوزحطيکكلمنسعفصقرشتثخذضظغ]|الف|باء|جيم|دال)$/u.test(rest))return null;
 return {grade:ordinal+offset,section:rest.replace(/^\s*[/ -]\s*/, '')};
}
function key(value){
 if(value&&typeof value==='object'){
  const grade=Number(value.grade);
  if(Number.isInteger(grade)&&grade>=1&&grade<=12)return {grade,section:normalize(value.label ?? value.name)};
  return parsed(value.classroom ?? value.name ?? value.label);
 }
 return parsed(value);
}
const label=value=>typeof value==='object'&&value ? value.classroom ?? value.name ?? value.label ?? '' : value;
export function compareAcademicClasses(a,b){
 const x=key(a),y=key(b);
 if(x&&y)return x.grade-y.grade||natural.compare(x.section,y.section);
 if(x||y)return x?-1:1;
 return natural.compare(normalize(label(a)),normalize(label(b)));
}


// Display-only grade/section labels for constrained class cards, schedule
// cells and small-screen headings. Never use for matching or persistence.
const COMPACT_GRADES = Object.freeze([
  '', 'أول', 'ثاني', 'ثالث', 'رابع', 'خامس', 'سادس',
  'أول م', 'ثاني م', 'ثالث م', 'أول ث', 'ثاني ث', 'ثالث ث',
]);
const FULL_GRADES = Object.freeze([
  '', 'الأول الابتدائي', 'الثاني الابتدائي', 'الثالث الابتدائي',
  'الرابع الابتدائي', 'الخامس الابتدائي', 'السادس الابتدائي',
  'الأول المتوسط', 'الثاني المتوسط', 'الثالث المتوسط',
  'الأول الثانوي', 'الثاني الثانوي', 'الثالث الثانوي',
]);

export function compactSectionLabel(section) {
  if (!section) return '';
  const grade = Number(section.grade);
  const short = COMPACT_GRADES[grade];
  const raw = String(section.label ?? section.name ?? '').trim();
  if (!short) return raw;
  let suffix = raw;
  // Legacy section labels can include the grade; do not duplicate it.
  for (const prefix of [FULL_GRADES[grade], short, 'ال' + short]) {
    if (!prefix || !suffix.startsWith(prefix)) continue;
    const remaining = suffix.slice(prefix.length);
    if (!remaining || /^[\s/—–-]/u.test(remaining)) {
      suffix = remaining.replace(/^[\s/—–-]+/u, '').trim();
      break;
    }
  }
  return suffix ? short + '/' + suffix : short;
}
