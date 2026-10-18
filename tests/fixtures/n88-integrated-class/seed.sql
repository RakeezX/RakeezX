-- AI: fabricated canonical class with two students, existing model score/task fixture.
delete from rakeezx.students;
insert into rakeezx.years("id","owner_id","revision","status","deleted_at") values('year','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','active',null);
insert into rakeezx.terms("id","owner_id","revision","year_id","status","start_date","end_date","deleted_at") values('term','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','year','active','2026-08-01','2027-01-01',null);
insert into rakeezx.sections("id","owner_id","revision","year_id","grade","label","status","deleted_at") values('class','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','year',4,'أ','active',null);
insert into rakeezx.students("id","owner_id","revision","name","status","deleted_at") values('student','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','طالب اصطناعي','active',null);
insert into rakeezx.students("id","owner_id","revision","name","status","deleted_at") values('other','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','خالد أحمد','active',null);
insert into rakeezx.enrollments("id","owner_id","revision","student_id","section_id","start_date","end_date","status","deleted_at") values('enrollment','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','student','class','2026-08-01',null,'active',null);
insert into rakeezx.teachings("id","owner_id","revision","section_id","term_id","subject_id","deleted_at") values('teaching','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','class','term','subject',null);
insert into rakeezx.items("id","owner_id","revision","name","teaching_id","max","score_mode","order","deleted_at") values('direct','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','مباشر','teaching',10,'direct',0,null);
insert into rakeezx.items("id","owner_id","revision","name","teaching_id","max","order","deleted_at") values('zero','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','صفر','teaching',10,1,null);
insert into rakeezx.items("id","owner_id","revision","name","teaching_id","max","order","deleted_at") values('missing','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','لم يرصد','teaching',10,2,null);
insert into rakeezx.items("id","owner_id","revision","name","teaching_id","max","auto","per_point","order","deleted_at") values('participation','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','مشاركة','teaching',10,'participation',2,3,null);
insert into rakeezx.items("id","owner_id","revision","name","teaching_id","max","auto","penalty","order","deleted_at") values('attendance','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','حضور','teaching',10,'attendance',2,4,null);
insert into rakeezx.items("id","owner_id","revision","name","teaching_id","max","score_mode","order","deleted_at") values('subitems','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','مهام','teaching',10,'subitems',5,null);
insert into rakeezx.scores("id","owner_id","revision","student_id","item_id","value","deleted_at") values('score-direct','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','student','direct',8,null);
insert into rakeezx.scores("id","owner_id","revision","student_id","item_id","value","deleted_at") values('score-zero','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','student','zero',0,null);
insert into rakeezx.scores("id","owner_id","revision","student_id","item_id","value","deleted_at") values('score-other','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','other','missing',9,null);
insert into rakeezx.scores("id","owner_id","revision","student_id","item_id","derived_value","manual_value","value","deleted_at") values('score-subitems','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','student','subitems',3,1,4,null);
insert into rakeezx.score_subitems("id","owner_id","revision","item_id","name","value","due_date","order","deleted_at") values('regular','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','subitems','مكتمل',2,'2026-10-01',0,null);
insert into rakeezx.score_subitems("id","owner_id","revision","item_id","name","value","late_points","due_date","order","deleted_at") values('late','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','subitems','مكتمل متأخر',3,1,'2026-10-01',1,null);
insert into rakeezx.score_subitems("id","owner_id","revision","item_id","name","value","due_date","order","deleted_at") values('overdue','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','subitems','مطلوب متأخر',2,'2026-10-01',2,null);
insert into rakeezx.score_subitems("id","owner_id","revision","item_id","name","value","start_date","due_date","order","deleted_at") values('future','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','subitems','قادم',3,'2026-10-20','2026-10-25',3,null);
insert into rakeezx.score_subitem_completions("id","owner_id","revision","student_id","subitem_id","checked","deleted_at") values('completion-regular','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','student','regular',true,null);
insert into rakeezx.score_subitem_completions("id","owner_id","revision","student_id","subitem_id","checked","completion_state","deleted_at") values('completion-late','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','student','late',true,'late',null);
insert into rakeezx.score_subitem_completions("id","owner_id","revision","student_id","subitem_id","checked","deleted_at") values('completion-other','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','other','overdue',true,null);
insert into rakeezx.sessions("id","owner_id","revision","teaching_id","date","status","deleted_at") values('session','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','teaching','2026-10-01','held',null);
insert into rakeezx.sessions("id","owner_id","revision","teaching_id","date","status","deleted_at") values('session2','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','teaching','2026-10-02','held',null);
insert into rakeezx.attendance("id","owner_id","revision","student_id","teaching_id","session_id","status","deleted_at") values('att-excused','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','student','teaching','session','excused',null);
insert into rakeezx.attendance("id","owner_id","revision","student_id","teaching_id","session_id","status","deleted_at") values('att-absent','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','student','teaching','session2','absent',null);
insert into rakeezx.logs("id","owner_id","revision","student_id","teaching_id","kind","delta","deleted_at") values('log','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','student','teaching','participation',2,null);
insert into rakeezx.logs("id","owner_id","revision","student_id","teaching_id","kind","delta","deleted_at") values('log-other','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','1','other','teaching','participation',10,null);
insert into rakeezx.enrollments(owner_id,id,student_id,section_id,revision,status,start_date) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','enrollment-other','other','class',1,'active','2026-08-01');
insert into n88_private.contexts values('n88_integrated_synthetic_01','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true) on conflict(owner_id) do nothing;

-- Second student must also have the canonical atomic subitem projection.
insert into rakeezx.scores(owner_id,id,student_id,item_id,revision,value,manual_value,derived_value) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','score-other-subitems','other','subitems',1,2,null,2);
