import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {configureStore} from '@reduxjs/toolkit';
import {createBookingAttempt,isTerminalBookingFailure} from '../../client/src/lib/api/booking-attempt.js';
import {ApiError,resolveApiBaseUrl} from '../../client/src/lib/api/client.js';
import {createBooking,type CreateBookingPayload} from '../../client/src/lib/api/bookings.js';
import {changeBookingCommercial} from '../../client/src/lib/api/booking-commercial.js';
import {createLatestRequestScope} from '../../client/src/lib/api/latest-request.js';
import {getAdminBookings} from '../../client/src/lib/api/admin.js';
import reducer,{openBookingModal,closeBookingModal,clearBookingState,submitBookingThunk} from '../../client/src/redux/slices/bookingSlice.js';

vi.mock('pg',()=>{throw new Error('PHASE2_DATABASE_FORBIDDEN');});
vi.mock('dotenv',()=>{throw new Error('PHASE2_ENV_DISCOVERY_FORBIDDEN');});
const payload:CreateBookingPayload={bookingType:'FLIGHT',bookingModel:'AGENCY_INQUIRY',customerName:'Synthetic Customer',customerEmail:'synthetic@example.invalid',
  totalPrice:0,currency:'BDT',passengers:[{firstName:'Synthetic',lastName:'Traveller',passengerType:'adult'}]};
const id='00000000-0000-4000-8000-000000000001';
const booking={id:'synthetic-booking',referenceNumber:'FWS-SYNTHETIC',status:'PENDING',customerName:payload.customerName,customerEmail:payload.customerEmail,
  totalPrice:0,currency:'BDT',passengerCount:1,createdAt:'2026-10-31T00:00:00.000Z'};
const target={type:'FLIGHT' as const,title:'Synthetic booking request',totalPrice:0,currency:'BDT',details:{}};
const store=()=>configureStore({reducer:{booking:reducer}});
const success=()=>new Response(JSON.stringify({success:true,data:{booking}}),{status:201,headers:{'Content-Type':'application/json'}});
let fetcher:ReturnType<typeof vi.fn>;
beforeEach(()=>{
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL','https://synthetic.example.invalid/api/v1');
  fetcher=vi.fn(async(url:string)=>{if(!url.startsWith('https://synthetic.example.invalid/'))throw new Error('PHASE2_EXTERNAL_REQUEST_FORBIDDEN');return success();});
  vi.stubGlobal('fetch',fetcher);
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();});

describe('Phase2 booking request identity lifecycle — OFFLINE',()=>{
  it('does not overwrite a newer admin result with an older slow API response',async()=>{
    const reads=createLatestRequestScope();let visible='';let finish!:(response:Response)=>void;
    fetcher.mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve;}));
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({success:true,data:{bookings:[{id:'new'}]}}),{status:200}));
    const load=async()=>{const current=reads.begin();const result=await getAdminBookings();if(current())visible=result.bookings[0].id;};
    const old=load();await load();finish(new Response(JSON.stringify({success:true,data:{bookings:[{id:'old'}]}}),{status:200}));await old;
    expect(visible).toBe('new');
  });
  it('invalidates an in-flight read on navigation/unmount without touching the API',()=>{
    const reads=createLatestRequestScope(),current=reads.begin();expect(current()).toBe(true);reads.cancel();expect(current()).toBe(false);expect(fetcher).not.toHaveBeenCalled();
  });
  it('supersedes old error/finally handlers when a newer read begins',()=>{
    const reads=createLatestRequestScope(),old=reads.begin(),current=reads.begin();
    let error='';let loading=true;if(old()) {error='old';loading=false;}
    expect(error).toBe('');expect(loading).toBe(true);expect(current()).toBe(true);
  });
  it('pins an explicitly isolated local browser backend without probing or production fallback',async()=>{
    vi.stubGlobal('window',{location:{hostname:'phase2.localhost'}});
    vi.stubEnv('NEXT_PUBLIC_LOCAL_API_BASE_URL','http://phase2.localhost:5002/api/v1');
    expect(await resolveApiBaseUrl()).toBe('http://phase2.localhost:5002/api/v1');expect(fetcher).not.toHaveBeenCalled();
  });
  it('pins isolated development SSR to the same backend',async()=>{
    vi.stubEnv('NEXT_PUBLIC_LOCAL_API_BASE_URL','http://localhost:5002/api/v1');
    expect(await resolveApiBaseUrl()).toBe('http://localhost:5002/api/v1');expect(fetcher).not.toHaveBeenCalled();
  });
  for(const [index,url] of ['https://remote.invalid/api/v1','http://user:private@localhost:5002/api/v1','http://localhost:5002/api/v1?password=private','invalid-private-value'].entries())it('fails closed on an unsafe isolated target '+index,async()=>{
    vi.stubGlobal('window',{location:{hostname:'localhost'}});vi.stubEnv('NEXT_PUBLIC_LOCAL_API_BASE_URL',url);
    await expect(resolveApiBaseUrl()).rejects.toMatchObject({code:'LOCAL_API_CONFIG'});expect(fetcher).not.toHaveBeenCalled();
  });
  it('routes customer quotation acceptance through the authenticated account boundary', async()=>{
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({success:true,data:{booking:{commercial:{version:1,revision:2,quotes:[],payments:[]}}}}),{status:200}));
    await changeBookingCommercial('FWS-SYNTHETIC','account',{action:'ACCEPT_QUOTE',requestId:id,quoteId:id,expectedRevision:1});
    expect(fetcher.mock.calls[0][0]).toContain('/account/bookings/FWS-SYNTHETIC/commercial');
    expect(fetcher.mock.calls[0][1].credentials).toBe('include');
  });
  it('preserves commercial request identity across explicit ambiguous retries', async()=>{
    const command={action:'RECORD_PAYMENT' as const,requestId:id,expectedRevision:2,amount:100,currency:'BDT',method:'CASH' as const};
    fetcher.mockRejectedValueOnce(new TypeError('synthetic-transport'));
    await expect(changeBookingCommercial('FWS-SYNTHETIC','admin',command)).rejects.toMatchObject({code:'NETWORK_ERROR'});
    await changeBookingCommercial('FWS-SYNTHETIC','admin',command);
    expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('bounds commercial transport without an automatic retry', async()=>{
    vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
    fetcher.mockImplementationOnce((_url:string,options:RequestInit)=>new Promise<Response>((_resolve,reject)=>{
      options.signal?.addEventListener('abort',()=>reject(new DOMException('Synthetic timeout','AbortError')),{once:true});
    }));
    const outcome=changeBookingCommercial('FWS-SYNTHETIC','admin',{action:'OFFER_QUOTE',requestId:id,expectedRevision:0,amount:100,currency:'BDT',validUntil:'2026-11-01T00:00:00Z'}).catch(error=>error);
    await vi.advanceTimersByTimeAsync(30000);expect(await outcome).toMatchObject({code:'NETWORK_ERROR',status:0});expect(fetcher).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
  });
  it('retains one identity for an explicit ambiguous retry without an automatic request',()=>{
    const a=createBookingAttempt(),first=a.begin()!;first.settle(false);expect(a.begin()!.requestId).toBe(first.requestId);expect(fetcher).not.toHaveBeenCalled();
  });
  it('blocks synchronous double dispatch',()=>{const a=createBookingAttempt(),first=a.begin()!;expect(a.begin()).toBeNull();first.settle(false);expect(a.begin()).not.toBeNull();});
  it('edits create a new identity only after the in-flight attempt settles',()=>{
    const a=createBookingAttempt(),first=a.begin()!;a.invalidate();expect(a.begin()).toBeNull();first.settle(true);expect(a.begin()!.requestId).not.toBe(first.requestId);
  });
  it('settling an old ticket twice cannot clear or unlock a newer attempt',()=>{
    const a=createBookingAttempt(),first=a.begin()!;first.settle(false);const second=a.begin()!;first.settle(true);expect(a.begin()).toBeNull();second.settle(false);expect(a.begin()!.requestId).toBe(second.requestId);
  });
  it('success ends the previous logical request',()=>{const a=createBookingAttempt(),first=a.begin()!;first.settle(true);expect(a.begin()!.requestId).not.toBe(first.requestId);});
  it('exposes no payload or request identity through JSON serialization',()=>{const a=createBookingAttempt();a.begin();expect(JSON.stringify(a)).toBe('{}');});
  it('fails closed when secure identity generation is unavailable',()=>{vi.stubGlobal('crypto',undefined);expect(()=>createBookingAttempt().begin()).toThrow('Secure request identity unavailable.');expect(fetcher).not.toHaveBeenCalled();});
  for(const status of [0,408,429,500,503])it('keeps ambiguous/transient identity at status '+status,()=>expect(isTerminalBookingFailure(new ApiError('SYNTHETIC','Synthetic',status))).toBe(false));
  for(const status of [400,401,403,409,422])it('ends definitively rejected identity at status '+status,()=>expect(isTerminalBookingFailure(new ApiError('SYNTHETIC','Synthetic',status))).toBe(true));
  it('treats a network exception as an ambiguous outcome',()=>expect(isTerminalBookingFailure(new TypeError('Synthetic network failure'))).toBe(false));
});

describe('actual booking API and Redux submission boundary; fetch doubled',()=>{
  it('bounds a stalled request, keeps its outcome ambiguous and never automatically retries',async()=>{
    vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
    fetcher.mockImplementationOnce((_url:string,options:RequestInit)=>new Promise<Response>((_resolve,reject)=>{
      options.signal?.addEventListener('abort',()=>reject(new DOMException('Synthetic request timeout','AbortError')),{once:true});
    }));
    const outcome=createBooking(payload,id).then(()=>null,error=>error as unknown);
    await vi.advanceTimersByTimeAsync(30000);const failure=await outcome;
    expect(failure).toMatchObject({name:'ApiError',code:'NETWORK_ERROR',status:0});expect(isTerminalBookingFailure(failure)).toBe(false);expect(fetcher).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
  });
  for(const invalid of ['', 'unsafe-request'])it('rejects malformed identity before HTTP '+invalid,async()=>{
    await expect(createBooking(payload,invalid)).rejects.toMatchObject({status:400,code:'INVALID_REQUEST_ID'});expect(fetcher).not.toHaveBeenCalled();
  });
  it('forwards only the header identity while preserving the existing body contract',async()=>{
    await createBooking(payload,id);const args=fetcher.mock.calls[0] as unknown as [string,RequestInit];
    expect(args[0]).toBe('https://synthetic.example.invalid/api/v1/bookings');expect(new Headers(args[1].headers).get('Idempotency-Key')).toBe(id);
    expect(JSON.parse(String(args[1].body))).toEqual(payload);expect(args[1].credentials).toBe('include');
  });
  it('normalizes uppercase UUIDs consistently',async()=>{
    const upper='ABCDEFAB-0000-4000-8000-000000000001';await createBooking(payload,upper);
    expect(new Headers((fetcher.mock.calls[0] as unknown as [string,RequestInit])[1].headers).get('Idempotency-Key')).toBe(upper.toLowerCase());
  });
  it('retains the same key across a 5xx response and explicit successful retry',async()=>{
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({success:false,code:'INTERNAL_ERROR',message:'SYNTHETIC_PRIVATE_SERVER_DETAIL'}),{status:503}));
    const s=store(),a=createBookingAttempt(),first=a.begin()!,one=await s.dispatch(submitBookingThunk({payload,requestId:first.requestId}));
    expect(submitBookingThunk.rejected.match(one)).toBe(true);if(!submitBookingThunk.rejected.match(one))throw new Error('EXPECTED_REJECTION');
    expect(one.payload?.terminal).toBe(false);expect(s.getState().booking.submitError).not.toContain('SYNTHETIC_PRIVATE');first.settle(one.payload?.terminal===true);
    const second=a.begin()!;expect(second.requestId).toBe(first.requestId);await s.dispatch(submitBookingThunk({payload,requestId:second.requestId}));
    expect(s.getState().booking.submitStatus).toBe('succeeded');expect(fetcher).toHaveBeenCalledTimes(2);
    const keys=fetcher.mock.calls.map(call=>new Headers((call as unknown as [string,RequestInit])[1].headers).get('Idempotency-Key'));expect(keys).toEqual([first.requestId,first.requestId]);
  });
  it('retains identity and sanitizes unexpected network failures',async()=>{
    fetcher.mockRejectedValueOnce(new TypeError('SYNTHETIC_PRIVATE_NETWORK_DETAIL'));const s=store(),one=await s.dispatch(submitBookingThunk({payload,requestId:id}));
    expect(submitBookingThunk.rejected.match(one)).toBe(true);if(!submitBookingThunk.rejected.match(one))throw new Error('EXPECTED_REJECTION');
    expect(one.payload?.terminal).toBe(false);expect(s.getState().booking.submitError).not.toContain('SYNTHETIC_PRIVATE');
  });
  it('ends an identity on a definitive validation failure',async()=>{
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({success:false,code:'VALIDATION_ERROR',message:'Invalid booking request'}),{status:422}));
    const s=store(),one=await s.dispatch(submitBookingThunk({payload,requestId:id}));expect(submitBookingThunk.rejected.match(one)).toBe(true);
    if(!submitBookingThunk.rejected.match(one))throw new Error('EXPECTED_REJECTION');expect(one.payload?.terminal).toBe(true);
  });
  it('prevents a pending request from being closed, retargeted, cleared or dispatched twice',async()=>{
    let complete!:(response:Response)=>void;fetcher.mockImplementationOnce(()=>new Promise<Response>(resolve=>{complete=resolve;}));
    const s=store();s.dispatch(openBookingModal(target));const first=s.dispatch(submitBookingThunk({payload,requestId:id}));
    s.dispatch(closeBookingModal());s.dispatch(clearBookingState());s.dispatch(openBookingModal({...target,title:'Different synthetic request'}));
    expect(s.getState().booking.isBookingModalOpen).toBe(true);expect(s.getState().booking.submitStatus).toBe('loading');expect(s.getState().booking.bookingTarget?.title).toBe(target.title);
    await s.dispatch(submitBookingThunk({payload,requestId:id}));expect(fetcher).toHaveBeenCalledTimes(1);complete(success());await first;
    expect(s.getState().booking.submitStatus).toBe('succeeded');
  });
  it('ignores stale completions and clears an old success when a new request opens',()=>{
    const input={payload,requestId:id};let state=reducer(undefined,submitBookingThunk.pending('current',input));
    state=reducer(state,submitBookingThunk.fulfilled({booking},'stale',input));expect(state.submitStatus).toBe('loading');expect(state.recentBooking).toBeNull();
    state=reducer(state,submitBookingThunk.fulfilled({booking},'current',input));expect(state.recentBooking?.id).toBe(booking.id);
    state=reducer(state,openBookingModal(target));expect(state.recentBooking).toBeNull();expect(state.submitStatus).toBe('idle');
  });
});
