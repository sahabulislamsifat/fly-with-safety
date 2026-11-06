import { expect, it, vi } from 'vitest';
vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));
vi.mock('pg', () => { throw Error('OFFLINE_DATABASE_FORBIDDEN'); });
import {GatewayError} from '../src/payments/sslcommerz.js';
import {checkFinancialRows} from './phase3-final-reconciliation/checks.js';
import { PaymentService } from '../src/payments/payment.service.js';
import { settle, type Attempt, type Booking, type Refund } from '../src/payments/payment-domain.js';
import type { Ledger, PaymentStore } from '../src/payments/payment-store.js';
import type { Evidence, Gateway, GatewayConfig } from '../src/payments/sslcommerz.js';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = { id: 'owner', role: 'CUSTOMER' as const }, admin = { id: 'admin', role: 'ADMIN' as const };
const now = +new Date('2026-11-03T12:00:00Z');
function booking(): Booking { return { id: 'booking', referenceNumber: 'FWS-SYNTHETIC', userId: owner.id, status: 'PENDING', currency: 'BDT', totalPrice: 12000, customerName: 'Synthetic', customerEmail: 'owner@example.invalid', customerPhone: '01000000000', bookingDetails: { commercial: { version: 1, revision: 2, quotes: [{ id: id(1), amount: 12000, currency: 'BDT', description: 'Synthetic service', validUntil: '2026-11-04T00:00:00Z', createdAt: '2026-11-01T00:00:00Z', acceptedAt: '2026-11-02T00:00:00Z' }], payments: [], receipts: [] } } }; }
const billing = { requestId: id(2), address: 'Test address', city: 'Test city', country: 'BD' };
const config: GatewayConfig = { storeId: 'synthetic', password: 'synthetic', callbackOrigin: 'https://callbacks.example.invalid', frontendOrigin: 'http://localhost:3000', storageKey: Buffer.alloc(32, 7), refunds: true };
// Serial in-memory transactions model rollback for unit tests ONLY. This is not PostgreSQL concurrency proof.
function fixture() {
  let state = { booking: booking(), attempts: [] as Attempt[], refunds: [] as Refund[], events: [] as string[], captures: 0 };
  let chain = Promise.resolve();
  let inside = false;
  const store: PaymentStore = {
    async transaction<T>(_reference: string, action: (l: Ledger) => Promise<T>) {
      const previous = chain; let unlock!: () => void; chain = new Promise<void>(r => { unlock = r; }); await previous;
      const copy = structuredClone(state); inside = true;
      const l: Ledger = { ...copy, now, history: [],
        async save(a) { l.attempts = l.attempts.filter(p => p.id !== a.id).concat(structuredClone(a)); },
        async saveRefund(r) { l.refunds = l.refunds.filter(p => p.id !== r.id).concat(structuredClone(r)); },
        async event(_id, key) { if (copy.events.includes(key)) return false; copy.events.push(key); return true; },
        async publish() { copy.captures++; },
      };
      try { const result = await action(l); state = { ...copy, booking: l.booking, attempts: l.attempts, refunds: l.refunds }; return structuredClone(result); }
      finally { inside = false; unlock(); }
    },
    async locate(t) { return state.attempts.some(a => a.tranId === t) ? state.booking.referenceNumber : null; },
    async due() { return [state.booking.referenceNumber]; },
    async operations() { return []; },
  };
  const evidence = (): Evidence => ({ status: 'VALID', tranId: state.attempts[0].tranId, amountMinor: '1200000', currency: 'BDT', valId: 'validation', bankId: 'bank', risk: false });
  const gateway: Gateway = {
    initiate: vi.fn(async () => { expect(inside).toBe(false); expect(state.attempts).toHaveLength(1); return { sessionKey: 'synthetic', url: 'https://sandbox.sslcommerz.com/checkout', channels: ['visa'] }; }),
    query: vi.fn(async () => { expect(inside).toBe(false); return [evidence()]; }),
    validate: vi.fn(async () => { expect(inside).toBe(false); return evidence(); }),
    refund: vi.fn(async () => { expect(inside).toBe(false); expect(state.refunds).toHaveLength(1); return { reference: 'refund-ref', tranId: state.attempts[0].tranId }; }),
    refundStatus: vi.fn(async () => ({ status: 'refunded' as const, bankId: 'bank', tranId: state.attempts[0].tranId, amountMinor: '100' })),
  };
  const service = new PaymentService(store, gateway, config);
  return { service, store, gateway, state: () => state, evidence };
}
async function ready() { const f = fixture(); await f.service.initiate('FWS-SYNTHETIC', owner, billing); return f; }

it('SIMULATED PROCESSING rejection preserves nonterminal intent without capture, settlement or fulfillment',async()=>{const f=await ready();vi.mocked(f.gateway.query).mockRejectedValue(new GatewayError('MALFORMED','PROCESSING'));await f.service.reconcile('FWS-SYNTHETIC',admin);expect(f.state().attempts[0].status).toBe('SESSION_READY');expect(f.state().attempts[0].captured).toBe(false);expect(f.state().captures).toBe(0);expect(f.state().booking.status).toBe('PENDING');expect(f.gateway.validate).not.toHaveBeenCalled();expect(f.state().events.some(e=>e.startsWith('unresolved:'))).toBe(true);});
it('SIMULATED unresolved state is consistent for owner/staff/admin and hidden from other customer',async()=>{const f=await ready();const a=await f.service.list('FWS-SYNTHETIC',owner),b=await f.service.list('FWS-SYNTHETIC',{id:'staff',role:'STAFF'}),c=await f.service.list('FWS-SYNTHETIC',admin);expect(a.payments).toEqual(b.payments);expect(a.payments).toEqual(c.payments);expect(a.payments[0].captured).toBe(false);expect(a.payments[0].fulfillment).toBe('NOT_PAID');await expect(f.service.list('FWS-SYNTHETIC',{id:'other',role:'CUSTOMER'})).rejects.toThrow();});
it('SIMULATED settlement cannot convert PROCESSING into a terminal outcome or mutate booking',async()=>{const f=await ready(),a=f.state().attempts[0],before=structuredClone(f.state().booking);const next=settle(a,f.state().booking,{...f.evidence(),status:'PROCESSING'},now);expect(next.status).toBe('UNKNOWN');expect(next.captured).toBe(false);expect(f.state().booking).toEqual(before);});
const rows=()=>[{id:'paid',bookingId:'one',status:'VERIFIED',captured:true,state:{status:'VERIFIED',captured:true,valId:'private-validation',bankId:'private-bank',amountMinor:'1200000',currency:'BDT'}},{id:'unresolved',bookingId:'two',status:'SESSION_READY',captured:false,state:{status:'SESSION_READY',captured:false,amountMinor:'1200000',currency:'BDT'}}];
it('accepts only consistent saved success and nonterminal retained intent',()=>expect(checkFinancialRows(rows())).toEqual({payments:2,verified:1,unresolved:1,noTerminalNegative:true}));
it.each(['status','captured','amount','currency','validation','bank','count'])('rejects financial reconciliation mismatch %s',kind=>{const r=rows();if(kind==='status')r[1].state.status='FAILED';if(kind==='captured')r[1].state.captured=true;if(kind==='amount')r[0].state.amountMinor='1';if(kind==='currency')r[0].state.currency='USD';if(kind==='validation')r[0].state.valId='';if(kind==='bank')r[0].state.bankId='';if(kind==='count')r.pop();expect(()=>checkFinancialRows(r)).toThrow();});
