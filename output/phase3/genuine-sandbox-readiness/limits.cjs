'use strict';
// Owner-reviewed run budgets. Reserving an attempt is deliberately not refunded
// after ambiguous errors; never turn a failed request into automatic replay.
function limits(plan){
 const refs=new Map(plan.fixtures.map(f=>[f.reference,f]));
 if(refs.size!==plan.fixtures.length||plan.fixtures.length!==3)throw Error('EXACT_THREE_CASES_REQUIRED');
 const counts={};
 function reserve(kind,amount=1){if(!Number.isSafeInteger(amount)||amount<1||!Number.isSafeInteger(plan.caps[kind])||(counts[kind]||0)+amount>plan.caps[kind])throw Error('BOUND_EXCEEDED');counts[kind]=(counts[kind]||0)+amount;}
 function fixture(reference,bookingId,userId){const f=refs.get(reference);if(!f||f.bookingId!==bookingId||f.customerId!==userId)throw Error('UNOWNED_FIXTURE');return f;}
 function transaction(reference,bookingId,userId){fixture(reference,bookingId,userId);reserve('transactions');}
 return{reserve,fixture,transaction,snapshot:()=>({...counts})};
}
module.exports={limits};
