/** Purpose-created portable records only; foundation IDs are saved before writes. */
export function fixtureIds(runId) {
  const prefix='n71:'+runId+':';
  return Object.fromEntries(['year','term','closedTerm','section','teaching','student','enrollment','unit','lesson','item','subitemItem',
    'subitem','completion','directScore','derivedScore','slot','session','snapshot','attendance','note','rule','charter','goal','group',
    'log','report','assignment','submission','deletedAssignment','deletedSubmission','closedChild'].map(name=>[name,prefix+name]));
}
export function portableFixture(ids, foundation, at) {
  const subjectId=foundation.subjects[0].id,timeProfileId=foundation.timeProfiles[0].id;
  const base=(id,rest)=>({id,deleted:false,updatedAt:Date.parse(at),...rest});
  const teachingId=ids.teaching,studentId=ids.student;
  return {
    years:[base(ids.year,{label:'N71 synthetic 1450',hijriStart:1450,hijriEnd:1451,status:'active',calendarPresetId:null})],
    terms:[base(ids.term,{yearId:ids.year,name:'N71 active',index:1,status:'active'}),
      base(ids.closedTerm,{yearId:ids.year,name:'N71 immutable history',index:2,status:'closed'})],
    sections:[base(ids.section,{yearId:ids.year,grade:5,label:'N71',name:'N71 synthetic',status:'active'})],
    teachings:[base(teachingId,{sectionId:ids.section,subjectId,termId:ids.term,order:0})],
    students:[base(studentId,{name:'N71 synthetic student',note:'before restore',status:'active'})],
    enrollments:[base(ids.enrollment,{studentId,sectionId:ids.section,rollNo:1,status:'active',startDate:'2026-10-12'})],
    units:[base(ids.unit,{subjectId,grade:5,termIndex:1,name:'N71 portable unit',order:0,plannedSessions:1})],
    lessons:[base(ids.lesson,{unitId:ids.unit,name:'N71 portable lesson',order:0,plannedSessions:1})],
    items:[base(ids.item,{teachingId,name:'N71 direct',max:10,scoreMode:'direct',unitId:ids.unit,lessonId:ids.lesson}),
      base(ids.subitemItem,{teachingId,name:'N71 subitems',max:10,scoreMode:'subitems',distributionMode:'manual',distributionVersion:1})],
    scoreSubitems:[base(ids.subitem,{itemId:ids.subitemItem,name:'N71 criterion',value:10,order:0,distributionVersion:1})],
    scoreSubitemCompletions:[base(ids.completion,{studentId,subitemId:ids.subitem,checked:true})],
    scores:[base(ids.directScore,{studentId,itemId:ids.item,value:7,manualValue:7,derivedValue:null}),
      base(ids.derivedScore,{studentId,itemId:ids.subitemItem,value:10,manualValue:0,derivedValue:10})],
    slots:[base(ids.slot,{teachingId,weekday:1,period:1})],
    sessions:[base(ids.session,{teachingId,slotId:ids.slot,timeProfileId,date:'2026-10-12',period:1,status:'held',
      startTime:'07:00',endTime:'07:45',lessonId:ids.lesson,calendarContext:null})],
    sessionRosterSnapshots:[base(ids.snapshot,{sessionId:ids.session,teachingId,sectionId:ids.section,capturedAt:at,
      members:[{studentId,rollNo:1}],state:'complete'})],
    attendance:[base(ids.attendance,{studentId,sessionId:ids.session,teachingId,date:'2026-10-12',status:'present',note:''})],
    notes:[base(ids.note,{studentId,teachingId,sessionId:ids.session,date:'2026-10-12',kind:'general',text:'N71 retained note'})],
    classRules:[base(ids.rule,{teachingId,iconKey:'star',text:'N71 synthetic rule'})],
    classCharterSelections:[base(ids.charter,{teachingId,selectedRuleIds:[ids.rule]})],
    classGoals:[base(ids.goal,{teachingId,runId:ids.goal,date:'2026-10-12',sessionId:ids.session,text:'N71 synthetic goal',
      durationMinutes:5,rewardPoints:1,state:'cancelled',startedAt:at,completedAt:null,rewardOperationId:null})],
    groupArrangements:[base(ids.group,{teachingId,groups:[[studentId]]})],
    logs:[base(ids.log,{studentId,teachingId,sessionId:ids.session,date:'2026-10-12',kind:'participation',delta:1,tag:'n71',note:'N71 retained'})],
    closedTermReports:[base(ids.report,{termId:ids.closedTerm,yearId:ids.year,version:1,sourceManifest:[],
      payload:{synthetic:true,purpose:'N71-D099',students:[]},state:'complete',createdAt:Date.parse(at)})],
    assignments:[base(ids.assignment,{teachingId,lessonId:ids.lesson,itemId:ids.item,title:'N71 portable assignment',assignedDate:'2026-10-12',max:10}),
      base(ids.deletedAssignment,{teachingId,lessonId:ids.lesson,itemId:ids.item,title:'N71 deletion boundary',assignedDate:'2026-10-12',max:10})],
    submissions:[base(ids.submission,{studentId,assignmentId:ids.assignment,status:'submitted',score:7,note:'N71 retained'}),
      base(ids.deletedSubmission,{studentId,assignmentId:ids.deletedAssignment,status:'pending',score:null,note:'N71 deletion boundary'})],
  };
}
