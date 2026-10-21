import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewedNameRepairCheckOutcomes } from './apply-reviewed-maintenance.mjs';
const task={productId:'N36',requiredChecks:['red_first_reproduced'],postDeliveryChecks:['n36_if_changed_verified_package_stable_folder_parity']};
const result=(checks)=>({checks:[{name:'red_first_reproduced',status:'PASS'},...checks]});
test('declared publisher parity may remain NOT_RUN during exact-session check-name repair',()=>{
 assert.equal(reviewedNameRepairCheckOutcomes(task,result([{name:'n36_if_changed_verified_package_stable_folder_parity',status:'NOT_RUN'}])),true);
});
test('unrelated NOT_RUN and FAIL never become accepted evidence',()=>{
 assert.equal(reviewedNameRepairCheckOutcomes(task,result([{name:'unrelated',status:'NOT_RUN'}])),false);
 assert.equal(reviewedNameRepairCheckOutcomes(task,result([{name:'unrelated',status:'FAIL'}])),false);
 assert.equal(reviewedNameRepairCheckOutcomes({...task,postDeliveryChecks:[]},result([{name:'n36_if_changed_verified_package_stable_folder_parity',status:'NOT_RUN'}])),false);
 assert.equal(reviewedNameRepairCheckOutcomes({...task,postDeliveryChecks:['red_first_reproduced']},{checks:[{name:'red_first_reproduced',status:'NOT_RUN'}]}),false);
});
