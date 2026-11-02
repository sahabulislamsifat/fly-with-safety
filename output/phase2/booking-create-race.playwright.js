async page => {
 if(page.__phase2CreateProof)throw new Error('CREATE_PROOF_ALREADY_ADMITTED');
 const me=await page.request.get('http://localhost:5000/api/v1/auth/me');
 if((await me.json()).data?.user?.id!=='7a504831-759c-4c1c-8325-4a187f711d91')throw new Error('ACTOR_GUARD');
 const prior=await page.request.get('http://localhost:5000/api/v1/account/bookings');
 const old=(await prior.json()).data?.bookings;
 if(old?.length!==1||old[0].referenceNumber!=='FWS-2026-53YFS3')throw new Error('PRIOR_STATE_GUARD');
 const proof={phase:'prepared',concurrency:8,results:[],done:false}; page.__phase2CreateProof=proof;
 const url='http://localhost:5000/api/v1/bookings';
 const handler=async route=>{
  if(route.request().method()!=='POST'){await route.continue();return;}
  try {
   const payload=route.request().postDataJSON(),key=await route.request().headerValue('Idempotency-Key');
   if(!/^[a-f0-9-]{36}$/i.test(key||'')||payload.customerEmail!=='7a504831-759c-4c1c-8325-4a187f711d91@example.invalid'||payload.passengers?.length!==1||payload.passengers[0].firstName!=='Synthetic'||payload.passengers[0].lastName!=='RetryTraveller'||payload.passengers[0].passportNumber||payload.bookingType!=='FLIGHT'||payload.bookingModel!=='AGENCY_INQUIRY')throw new Error('PAYLOAD_GUARD');
   proof.phase='initial-create-race';proof.requestId=key;proof.payload=payload;
   const requests=[route.fetch({timeout:30000,maxRetries:0,maxRedirects:0}),...Array.from({length:7},()=>page.request.post(url,{data:payload,headers:{Origin:'http://localhost:3000','Idempotency-Key':key},timeout:30000,maxRetries:0,maxRedirects:0}))];
   const settled=await Promise.allSettled(requests);
   for(const result of settled){
    if(result.status!=='fulfilled'){proof.results.push({status:null,classification:'REQUEST_REJECTED'});continue;}
    const response=result.value;let body={};try{body=await response.json();}catch{}
    const b=body.data?.booking;
    proof.results.push({status:response.status(),bookingId:b?.id,reference:b?.referenceNumber,passengerId:b?.passengers?.[0]?.id,historyId:b?.statusHistory?.[0]?.id});
   }
   proof.racePassed=proof.results.length===8&&proof.results.every(r=>r.status===201)&&new Set(proof.results.map(r=>r.bookingId)).size===1;
   proof.phase=proof.racePassed?'committed-response-intentionally-lost':'failed-race';
  }catch{proof.phase='failed-before-or-during-race';}
  finally {await route.abort('failed');proof.done=true;}
 };
 await page.route(url,handler);
 await page.getByRole('button',{name:'Confirm & Submit Request',exact:true}).click();
 const deadline=Date.now()+35000;while(!proof.done&&Date.now()<deadline)await new Promise(r=>setTimeout(r,50));
 await page.unroute(url,handler);
 if(!proof.done)throw new Error('OBSERVATION_DEADLINE');
 await page.getByRole('alert').waitFor({timeout:5000});
 return {phase:proof.phase,concurrency:8,racePassed:proof.racePassed,requestId:proof.requestId,results:proof.results,expectedClientNetworkLoss:true,automaticReplayPerformed:false};
}
