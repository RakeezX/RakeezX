import test from 'node:test';
import assert from 'node:assert/strict';
import {classAuthNoticeDedupe} from '../src/lib/sync-warning-policy.js';

test('one actionable class login message replaces duplicate strip and lease notices only for auth',()=>{
 const base={isClassRoute:true,classStatus:'verification',syncStatus:'auth_required',isLoggedIn:false};
 assert.deepEqual(classAuthNoticeDedupe(base),{suppressSyncStrip:true,suppressLeaseNotice:true});
 assert.deepEqual(classAuthNoticeDedupe({...base,classStatus:'ownership'}),{suppressSyncStrip:false,suppressLeaseNotice:false});
 assert.deepEqual(classAuthNoticeDedupe({...base,syncStatus:'error',isLoggedIn:true}),{suppressSyncStrip:false,suppressLeaseNotice:false});
 assert.deepEqual(classAuthNoticeDedupe({...base,isClassRoute:false}),{suppressSyncStrip:false,suppressLeaseNotice:false});
 assert.deepEqual(classAuthNoticeDedupe({...base,isLoggedIn:true}),{suppressSyncStrip:true,suppressLeaseNotice:false});
});
