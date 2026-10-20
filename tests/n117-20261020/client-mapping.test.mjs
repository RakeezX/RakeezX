import test from 'node:test';
import assert from 'node:assert/strict';
import {EDUCATION_DEPARTMENT_OPTIONS as options,initialDepartmentCalendarPreset as mapped} from '../../src/lib/education-department-directory.js';
import {GENERAL_1448_1449_PRESET_ID as general,WESTERN_1448_1449_PRESET_ID as western} from '../../src/lib/calendar-presets.js';
import {validateProfileCompletion} from '../../src/lib/account-profile.js';
test('all 47 approved canonical departments map exactly; names from search are never accepted as selections',()=>{
  assert.equal(options.length,47);
  for(const {canonicalName,shortLabel} of options){
    assert.equal(mapped(canonicalName),['مكة المكرمة','جدة','المدينة المنورة','الطائف'].includes(shortLabel)?western:general,shortLabel);
    const profile={teacherName:'Synthetic teacher',phone:'0500000001',educationDepartment:canonicalName};
    assert.equal(validateProfileCompletion(profile,{requireDepartment:true}).valid,true);
    assert.equal(validateProfileCompletion(profile,{requireDepartment:true}).profile.educationDepartment,canonicalName);
  }
  for(const value of [null,'','جدة','الطائف','مكتب تعليم جدة','الإدارة العامة للتعليم بمحافظة جدة أخرى']){
    assert.equal(mapped(value),null);
    assert.equal(validateProfileCompletion({teacherName:'Synthetic',phone:'0500000001',educationDepartment:value},{requireDepartment:true}).valid,false);
  }
  assert.equal(validateProfileCompletion({teacherName:'Existing',phone:'0500000001'}).valid,true,'existing metadata attention contract is unchanged');
});
