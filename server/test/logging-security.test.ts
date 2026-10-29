import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FlightProvider, FlightSearchParams, FlightOffer } from '../src/services/providers/flight.provider.js';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';


const mocks=vi.hoisted(()=>({boundary:false}));
vi.mock('../src/lib/prisma.js',()=>{throw new Error('OUT04_DATABASE_IMPORT_FORBIDDEN')});
vi.mock('pg',()=>{throw new Error('PG_FORBIDDEN')});
vi.mock('@prisma/adapter-pg',()=>{throw new Error('ADAPTER_FORBIDDEN')});
vi.mock('dotenv',()=>{throw new Error('DOTENV_FORBIDDEN')});
vi.mock('nodemailer',()=>{throw new Error('SMTP_FORBIDDEN')});
const attempts: string[] = [];
const restore: Array<() => void> = [];
function installGuards(): void {
  const replace = (target: object, key: string, label: string) => {
    const original = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, writable: true, value: () => {
      attempts.push(label); throw new Error('OUT04_OFFLINE_BOUNDARY');
    } });
    restore.push(() => {
      if (original) Object.defineProperty(target, key, original);
      else Reflect.deleteProperty(target, key);
    });
  };
  for (const key of ['connect', 'createConnection']) replace(net, key, `net.${key}`);
  replace(net.Socket.prototype, 'connect', 'socket.connect');
  replace(tls, 'connect', 'tls.connect');
  for (const [name, target] of [['http', http], ['https', https]] as const) {
    for (const key of ['get', 'request']) replace(target, key, `${name}.${key}`);
    replace(target.Agent.prototype, 'createConnection', `${name}.agent`);
  }
  for (const target of [dns, dns.promises, dns.Resolver.prototype, dns.promises.Resolver.prototype]) {
    for (const key of Object.getOwnPropertyNames(target)) {
      if ((key === 'lookup' || key === 'lookupService' || key === 'reverse' || key.startsWith('resolve')) &&
          typeof Reflect.get(target, key) === 'function') replace(target, key, `dns.${key}`);
    }
  }
  replace(dgram, 'createSocket', 'udp');
  for (const key of ['exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync', 'fork']) {
    replace(childProcess, key, `process.${key}`);
  }
  replace(globalThis, 'fetch', 'fetch');
  if ('WebSocket' in globalThis) replace(globalThis, 'WebSocket', 'websocket');
  syncBuiltinESMExports();
  mocks.boundary = true;

}



const secret='SYNTHETIC-OUT04B-SECRET-7721';
let logs:unknown[][]=[];
let logging:typeof import('../src/lib/logger.js');
let requestLogging:typeof import('../src/middleware/request-id.js');
let errors:typeof import('../src/utils/errors.js');
let handler:typeof import('../src/middleware/error-handler.js');
let aggregator:typeof import('../src/services/flight-aggregator.service.js');
let mockFlights:typeof import('../src/services/providers/mock-flight.provider.js');
const params:FlightSearchParams={from:'DAC',to:'CXB',departureDate:'2027-06-20',passengers:1,cabinClass:'economy'};
beforeAll(async()=>{
 installGuards();expect(()=>net.connect(1,'127.0.0.1')).toThrow('OUT04_OFFLINE_BOUNDARY');attempts.length=0;
 vi.stubEnv('NODE_ENV','production');
 logging=await import('../src/lib/logger.js');
 errors=await import('../src/utils/errors.js');handler=await import('../src/middleware/error-handler.js');
 requestLogging=await import('../src/middleware/request-id.js');
 aggregator=await import('../src/services/flight-aggregator.service.js');
 mockFlights=await import('../src/services/providers/mock-flight.provider.js');
});
beforeEach(()=>{
 logs=[];vi.useFakeTimers();
 for(const method of ['error','warn','log'] as const)vi.spyOn(console,method).mockImplementation((...args)=>{logs.push(args);});
});
afterEach(()=>{expect(attempts).toEqual([]);vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();});
afterAll(()=>{vi.unstubAllEnvs();for(const undo of restore.reverse())undo();syncBuiltinESMExports();});
function clean(){expect(JSON.stringify(logs)).not.toContain(secret);}
describe('OUT-04-B error and provider boundaries',()=>{
 it.each(['P2000','P2002','P2025','23505'])('retains safe own driver code %s only',code=>{
  const error=Object.assign(new Error(secret),{code,cause:{token:secret}});
  expect(logging.serializeError(error)).toEqual({name:'OperationError',code});
  logging.logger.error('operation_failed',logging.serializeError(error));clean();
 });
 it.each([null,undefined,secret,42,Symbol('sentinel')])('sanitizes unknown thrown primitive',value=>{
  expect(logging.serializeError(value)).toEqual({name:'OperationError'});
 });
 it('does not execute accessor or inherited code getters',()=>{
  let reads=0;const get=()=>{reads++;throw new Error(secret);};
  for(const error of [Object.defineProperty({},'code',{get}),Object.create(Object.defineProperty({},'code',{get}))]){
   expect(logging.serializeError(error)).toEqual({name:'OperationError'});
  }
  expect(reads).toBe(0);
 });
 it('does not coerce unknown code objects or read error messages/stacks',()=>{
  let reads=0;const error=Object.defineProperties({code:{toString(){reads++;throw new Error(secret);}}},{message:{get(){reads++;throw new Error(secret);}},stack:{get(){reads++;throw new Error(secret);}}});
  expect(logging.serializeError(error)).toEqual({name:'OperationError'});expect(reads).toBe(0);
 });
 it('does not trigger Proxy traps, including revoked proxies',()=>{
  let traps=0;const fail=()=>{traps++;throw new Error(secret);};
  const proxy=new Proxy({},{get:fail,has:fail,getOwnPropertyDescriptor:fail,getPrototypeOf:fail,ownKeys:fail});
  const revoked=Proxy.revocable({},{});revoked.revoke();
  expect(logging.serializeError(proxy)).toEqual({name:'OperationError'});
  expect(logging.serializeError(revoked.proxy)).toEqual({name:'OperationError'});expect(traps).toBe(0);
 });
 it.each(['P2000 '+secret,secret,'23505\n'+secret,'P20000'])('drops an unapproved code',code=>{
  expect(logging.serializeError({code})).toEqual({name:'OperationError'});
 });
 it('logs a provider rejection without reading its raw message or provider name',async()=>{
  let reads=0;const rejection=Object.defineProperty({},'message',{get(){reads++;throw new Error(secret);}});
  const provider:FlightProvider={name:secret,searchFlights:vi.fn().mockRejectedValue(rejection)};
  const service=new aggregator.FlightAggregatorService([provider]);const result=await service.aggregate(params);
  expect(result.offers).toEqual([]);expect(reads).toBe(0);expect(vi.getTimerCount()).toBe(0);
  expect(JSON.stringify(logs)).toContain('flight_provider_failed');expect(JSON.stringify(logs)).toContain('providerIndex');clean();
 });
 it('keeps healthy provider results when another provider fails',async()=>{
  const healthy=new mockFlights.MockFlightProvider();
  const failing:FlightProvider={name:'synthetic-failure',searchFlights:vi.fn().mockRejectedValue(new Error(secret))};
  const pending=new aggregator.FlightAggregatorService([failing,healthy]).aggregate(params,5000);
  await vi.advanceTimersByTimeAsync(201);const result=await pending;
  expect(result.offers.length).toBeGreaterThan(0);expect(result.isDemoData).toBe(true);expect(result.stats.cheapestPrice).toBeGreaterThan(0);
  expect(vi.getTimerCount()).toBe(0);clean();
 });
 it('retains timeout shielding and never retries or retains its deadline timer',async()=>{
  const provider:FlightProvider={name:secret,searchFlights:vi.fn(()=>new Promise<FlightOffer[]>(()=>{}))};
  const pending=new aggregator.FlightAggregatorService([provider]).aggregate(params,50);
  await vi.advanceTimersByTimeAsync(50);const result=await pending;
  expect(result.offers).toEqual([]);expect(provider.searchFlights).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);clean();
 });
});
describe('OUT-04-B request-log minimization',()=>{
 function logRequest(originalUrl:string,route:unknown,method='GET'){
  let finish:()=>void=()=>{},header:unknown;const locals:Record<string,unknown>={};
  const req={originalUrl,route,method,header:()=> 'synthetic-request-id'};
  const res={statusCode:200,locals,setHeader:(_name:string,value:unknown)=>{header=value;},on:(_event:string,fn:()=>void)=>{finish=fn;}};
  // Structural doubles exercise only this middleware, never Express listen/network.
  Reflect.apply(requestLogging.requestId,undefined,[req,res,()=>{}]);finish();return {header,locals};
 }
 it('logs the matched template rather than path parameter or query secrets',()=>{
  const {header}=logRequest('/api/v1/bookings/'+secret+'?token='+secret,{path:'/bookings/:id'});
  expect(header).toBe('synthetic-request-id');expect(JSON.stringify(logs)).toContain('/bookings/:id');clean();
 });
 it.each([undefined,{}, {path:/unknown/}, {path:['/a','/b']}])('uses a fixed unmatched label for unknown routes',route=>{
  logRequest('/'+secret,route);expect(JSON.stringify(logs)).toContain('[unmatched]');clean();
 });
 it('bounds unknown HTTP methods without changing correlation/status/duration logging',()=>{
  logRequest('/'+secret,{path:'/known'},secret);
  const output=JSON.stringify(logs);expect(output).toContain('OTHER');expect(output).toContain('status');expect(output).toContain('durationMs');clean();
 });
});

describe('OUT-04-B public error classification',()=>{
 function respond(error:unknown){
  let status=0,body:unknown;const response={status(value:number){status=value;return response;},json(value:unknown){body=value;return response;}};
  Reflect.apply(handler.errorHandler,undefined,[error,{},response,()=>{}]);return {status,body};
 }
 it.each([[{code:'P2002'},409],[{code:'P2025'},404],[{type:'entity.too.large'},413],[{type:'entity.parse.failed',status:400},400]] as const)('preserves known public classification %#', (error,status)=>{
  const result=respond(error);expect(result.status).toBe(status);expect(JSON.stringify(result.body)).not.toContain(secret);
 });
 it('preserves native malformed JSON and ordinary operational responses',()=>{
  expect(respond(Object.assign(new SyntaxError(secret),{status:400})).status).toBe(400);
  const result=respond(errors.AppError.badRequest('Invalid input',{field:'required'}));
  expect(result.status).toBe(400);expect(JSON.stringify(result.body)).toContain('Invalid input');expect(JSON.stringify(result.body)).toContain('required');clean();
 });
 it('sanitizes operational 500 messages and details',()=>{
  const result=respond(new errors.AppError(secret,500,'INTERNAL_ERROR',{token:secret}));
  expect(result.status).toBe(500);expect(JSON.stringify(result.body)).not.toContain(secret);clean();
 });
 it.each([null,undefined,'synthetic-throw'])('handles unknown thrown primitives without a secondary error',value=>{
  const result=respond(value);expect(result.status).toBe(500);expect(JSON.stringify(result.body)).toContain('Internal server error');clean();
 });
 it('does not execute unknown error getters, Proxy traps or forged AppError prototypes',()=>{
  let reads=0;const fail=()=>{reads++;throw new Error(secret);};
  const accessor=Object.defineProperties({},Object.fromEntries(['code','name','status','type','message','stack'].map(key=>[key,{get:fail}])));
  const proxy=new Proxy({},{get:fail,has:fail,getOwnPropertyDescriptor:fail,getPrototypeOf:fail});
  const forged=Object.create(errors.AppError.prototype);Object.defineProperty(forged,'statusCode',{get:fail});
  const revoked=Proxy.revocable({},{});revoked.revoke();
  for(const error of [accessor,proxy,forged,revoked.proxy])expect(respond(error).status).toBe(500);
  expect(reads).toBe(0);clean();
 });
});
