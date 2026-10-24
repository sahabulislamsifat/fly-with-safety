async (page) => {
  const checks = [];
  const check = (name, passed) => checks.push({name, passed});
  const user = {id:'audit-user',email:'customer@example.test',name:'Amina Rahman',role:'CUSTOMER',emailVerified:true};
  const booking = {referenceNumber:'FWS-2026-1001',bookingType:'FLIGHT',bookingModel:'AGENCY_INQUIRY',status:'CONFIRMED',totalPrice:38940,currency:'BDT',bookingDetails:{},createdAt:'2026-06-10T10:00:00Z',updatedAt:'2026-06-11T10:00:00Z'};
  const inquiry = {id:'request-1',type:'flight',referenceNumber:'FWS-REQ-1',status:'PENDING',summary:'Dhaka to Cox’s Bazar',travelDate:'2026-11-15T00:00:00Z',createdAt:'2026-06-12T10:00:00Z',updatedAt:'2026-06-12T10:00:00Z'};
  const dashboard = {counts:{inquiries:1,pendingInquiries:1,bookings:1,confirmedBookings:1},memberSince:'2025-04-01T00:00:00Z',recent:[inquiry]};
  await page.route('https://fly-with-safety-server.vercel.app/api/v1/**', async route => {
    const url = new URL(route.request().url());
    let data = {};
    if (url.pathname.endsWith('/auth/me')) data = {user};
    else if (url.pathname.endsWith('/account/dashboard')) data = dashboard;
    else if (url.pathname.endsWith('/account/bookings')) data = {bookings:[booking],pagination:{page:Number(url.searchParams.get('page')||1),limit:10,total:1,totalPages:1}};
    else if (url.pathname.endsWith('/account/inquiries')) data = {inquiries:[inquiry],pagination:{page:Number(url.searchParams.get('page')||1),limit:10,total:1,totalPages:1}};
    else if (url.pathname.endsWith('/account/profile')) data = {user:{...user,name:route.request().postDataJSON().name}};
    else if (url.pathname.endsWith('/auth/logout') || url.pathname.endsWith('/auth/refresh')) data = {user};
    else if (url.pathname.includes('/account/bookings/')) data = {booking:{...booking,passengers:[],statusHistory:[]}};
    else if (url.pathname.includes('/account/inquiries/')) data = inquiry;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
  });
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:3100/account');
  await page.getByRole('heading',{name:'Account dashboard'}).waitFor();
  await page.getByText('Welcome back, Amina Rahman').waitFor();
  check('authenticated account identity and overview render', await page.getByText('FWS-REQ-1').count()===1);
  check('real member date renders', await page.getByText('Apr 1, 2025').count()===1);
  await page.getByRole('button',{name:'My bookings'}).click();
  await page.getByText('FWS-2026-1001').waitFor();
  check('booking list renders backend record', await page.getByText('Confirmed',{exact:true}).count()>=1);
  await page.getByLabel('Filter booking status').selectOption('CONFIRMED');
  await page.getByText('FWS-2026-1001').waitFor();
  check('booking status filter updates route', new URL(page.url()).searchParams.get('tab')==='bookings');
  await page.getByRole('button',{name:'Manage profile'}).click();
  await page.getByRole('heading',{name:'Personal details'}).waitFor();
  await page.getByRole('button',{name:/Edit details/}).click();
  await page.getByLabel('Full name').fill('Amina Test');
  await page.getByRole('button',{name:'Save changes'}).click();
  await page.getByText('Profile updated successfully.').waitFor();
  check('profile save confirms server response',true);
  await page.getByRole('button',{name:'My requests'}).click();
  await page.getByText('FWS-REQ-1').waitFor();
  check('requests navigation works',new URL(page.url()).searchParams.get('tab')==='requests');
  const widths=[];
  for(const width of [320,375,430,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    const measurement = await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].map(el=>({tag:el.tagName,className:typeof el.className==='string'?el.className:'',text:(el.textContent||'').trim().slice(0,50),right:el.getBoundingClientRect().right})).filter(el=>el.right>innerWidth+1).slice(0,8)}));
    widths.push(measurement);
    if (width===320) await page.screenshot({path:'output/playwright/customer-dashboard-mobile.png',fullPage:true});
  }
  check('no horizontal page overflow at target widths',widths.every(size=>size.scrollWidth<=size.width));
  return {checks,failed:checks.filter(item=>!item.passed),widths,errors};
}
