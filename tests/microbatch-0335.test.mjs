import test from 'node:test';import assert from 'node:assert/strict';
import {isBeforeScheduledStart} from '../src/lib/session-start-ui.js';
import {todaySessionPresentation,selectTodayFocus} from '../src/views/home.js';
const date='2026-09-27',at=time=>new Date(`${date}T${time}`);
test('N04 before/exact/after start and absent/invalid time use stored local session date',()=>{
 const s={date,startTime:'10:00'};
 assert.equal(isBeforeScheduledStart(s,at('09:59:59')),true);
 assert.equal(isBeforeScheduledStart(s,at('10:00:00')),false);
 assert.equal(isBeforeScheduledStart(s,at('10:00:01')),false);
 for(const time of ['',null,undefined,'25:00','10:99','bad'])assert.equal(isBeforeScheduledStart({...s,startTime:time},at('09:00:00')),false);
 assert.equal(isBeforeScheduledStart({...s,date:'2026-09-28'},at('10:01:00')),true);
 assert.equal(isBeforeScheduledStart({...s,date:'2026-09-26'},at('09:00:00')),false);
});
test('N11 presentation consumes existing completed/due/recorded truth without changing it',()=>{
 const past={startTime:'07:00',endTime:'07:45',status:'scheduled'};
 assert.deepEqual(todaySessionPresentation(past,{state:'completed',due:true},at('09:15:00')),{kind:'completed',label:'تم رصد الحضور'});
 assert.equal(todaySessionPresentation(past,{state:'pending',recorded:0},at('09:15:00')).label,'بانتظار رصد الحضور');
 assert.equal(todaySessionPresentation(past,{state:'pending',recorded:1},at('09:15:00')).label,'رصد الحضور غير مكتمل');
 assert.equal(todaySessionPresentation({startTime:'09:00',endTime:'09:45'},{state:'completed'},at('09:15:00')).kind,'current');
 assert.equal(todaySessionPresentation({startTime:'10:00',endTime:'10:45'},{state:'future'},at('09:15:00')).kind,'upcoming');
 assert.equal(todaySessionPresentation({startTime:''},{state:'future'},at('09:15:00')).label,'حصة بدون وقت محدد');
 assert.equal(todaySessionPresentation({...past,status:'cancelled'},{state:'excluded'},at('09:15:00')).kind,'neutral');
});
test('N11 focus prioritizes missing past attendance before upcoming without mutating period order',()=>{
 const sessions=[{id:'p',startTime:'07:00',endTime:'07:45'},{id:'u',startTime:'10:00',endTime:'10:45'}];const before=JSON.stringify(sessions);
 assert.equal(selectTodayFocus(sessions,{now:at('09:15:00'),attendanceState:s=>s.id==='p'?'pending':'future'}).session.id,'p');
 assert.equal(selectTodayFocus(sessions,{now:at('09:15:00'),attendanceState:s=>s.id==='p'?'completed':'future'}).session.id,'u');
 assert.equal(JSON.stringify(sessions),before);
});
