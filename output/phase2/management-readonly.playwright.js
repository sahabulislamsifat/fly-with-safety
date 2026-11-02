async page => {
 const role='__ROLE__',id=role==='ADMIN'?'76374639-4185-4f99-a451-155c2250503d':'698a9431-d269-4c63-ae57-23e14503d477';
 const checks=[];const check=(name,ok)=>{checks.push({id:name,passed:ok});if(!ok)throw new Error(role+'_BROWSER_'+name);};
 const me=await page.request.get('http://localhost:5000/api/v1/auth/me');const user=(await me.json()).data?.user;check('exact-role-actor',me.status()===200&&user?.id===id&&user.role===role);
 await page.goto('http://localhost:3000/admin');await page.getByRole('button',{name:'Bookings Processing',exact:true}).click();
 const oldRow=page.getByRole('row').filter({hasText:'FWS-2026-53YFS3'});await oldRow.waitFor();check('both-bookings-ui',await page.getByRole('row').filter({hasText:'FWS-2026-5LA6DA'}).isVisible());
 const list=await page.request.get('http://localhost:5000/api/v1/admin/bookings');const rows=(await list.json()).data?.bookings;const old=rows?.find(b=>b.referenceNumber==='FWS-2026-53YFS3'),fresh=rows?.find(b=>b.referenceNumber==='FWS-2026-5LA6DA');check('api-dashboard-sync',list.status()===200&&rows.length===2&&old.status==='COMPLETED'&&old.totalPrice===12000&&fresh.status==='PENDING'&&fresh.totalPrice===38940);
 check('persisted-passenger-commercial-history',old.passengers.length===1&&old.statusHistory.length===4&&old.commercial.quotes.length===3&&old.commercial.payments[0].status==='RECORDED_UNVERIFIED');
 check('durable-staff-actor',old.statusHistory.filter(h=>h.changedBy==='698a9431-d269-4c63-ae57-23e14503d477@example.invalid').length===2);
 await oldRow.getByRole('button',{name:'Review',exact:true}).click();await page.getByText('12,000 BDT · Accepted',{exact:true}).waitFor();
 const text=await page.locator('body').innerText();check('passenger-quote-payment-ui',text.includes('Passenger Manifest (1)')&&text.includes('Synthetic Traveller')&&text.includes('Recorded, not verified')&&text.includes('SYN-CONT-PAY-001'));check('audit-actor-ui',text.includes('Audit Status History')&&text.includes('698a9431-d269-4c63-ae57-23e14503d477@example.invalid'));check('authorized-management-controls',await page.getByRole('button',{name:'Save record',exact:true}).count()===1);
 await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByRole('row').filter({hasText:'FWS-2026-5LA6DA'}).waitFor();check('records-refresh',true);
 await page.reload();await page.getByRole('button',{name:'Bookings Processing',exact:true}).click();await page.getByRole('row').filter({hasText:'FWS-2026-53YFS3'}).getByRole('button',{name:'Review',exact:true}).click();await page.getByText('12,000 BDT · Accepted',{exact:true}).waitFor();check('reload-persistence',true);
 await page.getByRole('row').filter({hasText:'FWS-2026-5LA6DA'}).getByRole('button',{name:'Review',exact:true}).click();await page.getByText('1. Synthetic RetryTraveller',{exact:true}).waitFor();check('new-browser-booking-management-sync',true);
 return {role,passed:checks.length,failed:0,checks,mutations:false};
}
