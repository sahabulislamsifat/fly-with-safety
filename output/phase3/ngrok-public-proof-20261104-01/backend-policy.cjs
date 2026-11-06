'use strict';
function canRestore({backendStopped,proofStarted,proofExited,state,result}){
 if(backendStopped!==true||state?.backendAbsent!==true||state.connectorsAbsent!==true)return false;
 // Frontend monitoring NEVER blocks independent safe backend restoration.
 return !proofStarted||proofExited===true&&(!result||result.tunnelStopped===true&&result.listenerStopped===true);
}
function proofExitText(started,exit){return !started?'NOT_STARTED':exit===null?'UNCONFIRMED':String(exit);}
function failureLabel(error){const known=['BACKEND_ONLY_APPROVAL_REQUIRED','EXISTING_ATTEMPT_NO_RETRY','NORMAL_SERVICES_NOT_HEALTHY','EXISTING_CONTROL_STATE_INSPECT_FIRST','ROTATED_AUTH_GATE_INCOMPLETE'];return known.includes(error?.message)?error.message:'WORKFLOW_METADATA_OR_OWNERSHIP_ERROR';}
module.exports={canRestore,proofExitText,failureLabel};
