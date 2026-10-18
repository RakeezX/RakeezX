-- AI: fabricated local data ONLY, following the existing activation canonical fixture.
insert into rakeezx.years values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','year','active',null,1);
insert into rakeezx.terms values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','term1','year','active',null,1);
insert into rakeezx.sections values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','class1','year','active',null,1);
update rakeezx.students set name='طالب التجربة المصطنع' where owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
insert into rakeezx.enrollments values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','enrollment1','class1','student',1,'active',null,null);
insert into rakeezx.teachings values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','teaching1','class1','term1',null,1);
insert into rakeezx.items values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','item1','teaching1','نشاط التجربة المصطنع',null,null,1);
insert into n88_private.contexts values('n88_current_review_synthetic_01','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
