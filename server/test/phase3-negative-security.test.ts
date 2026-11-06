import { expect, it, vi } from 'vitest';
vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));
vi.mock('pg', () => { throw Error('OFFLINE_DATABASE_FORBIDDEN'); });
import { PaymentService } from '../src/payments/payment.service.js';
import { payable, settle, type Attempt, type Booking, type Refund } from '../src/payments/payment-domain.js';
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
it.each(['FAILED','CANCELLED'] as const)('SIMULATED authoritative %s persists once without capture/fulfillment',async status=>{const f=await ready();vi.mocked(f.gateway.query).mockImplementation(async()=>[{...f.evidence(),status}]);await f.service.notify(f.state().attempts[0].tranId,undefined,status==='FAILED'?'fail':'cancel');await f.service.reconcile('FWS-SYNTHETIC',admin);expect(f.state().attempts[0].status).toBe(status);expect(f.state().attempts[0].captured).toBe(false);expect(f.state().booking.status).toBe('PENDING');expect(f.state().captures).toBe(0);expect(f.gateway.validate).not.toHaveBeenCalled();});
it('SIMULATED duplicate IPN/browser notices never authorize funds by callback name',async()=>{const f=await ready(),tran=f.state().attempts[0].tranId;for(let i=0;i<4;i++)await f.service.notify(tran,undefined,'ipn');for(let i=0;i<4;i++)await f.service.notify(tran,undefined,'fail');expect(f.state().events.filter(e=>e.startsWith('notice:'))).toHaveLength(2);expect(f.state().attempts[0].captured).toBe(false);expect(f.gateway.query).not.toHaveBeenCalled();});
it('SIMULATED concurrent idempotent initiation dispatches exactly once',async()=>{const f=fixture();await Promise.all(Array.from({length:8},()=>f.service.initiate('FWS-SYNTHETIC',owner,billing)));expect(f.gateway.initiate).toHaveBeenCalledOnce();expect(f.state().attempts).toHaveLength(1);});
it('SIMULATED changed request payload and unknown transaction fail without provider dispatch',async()=>{const f=await ready();await expect(f.service.initiate('FWS-SYNTHETIC',owner,{...billing,city:'changed'})).rejects.toThrow();await expect(f.service.notify('unknown',undefined,'fail')).rejects.toThrow();expect(f.gateway.initiate).toHaveBeenCalledOnce();});
it.each([{tranId:'other'},{amountMinor:'1'},{currency:'USD'},{valId:'other'},{bankId:'other'}])('SIMULATED mismatched validation remains unresolved %j',async mismatch=>{const f=await ready();vi.mocked(f.gateway.validate).mockImplementation(async()=>({...f.evidence(),...mismatch}));await f.service.reconcile('FWS-SYNTHETIC',admin);expect(f.state().attempts[0].captured).toBe(false);expect(f.state().captures).toBe(0);});
it('SIMULATED risk is held for review with booking still PENDING',async()=>{const f=await ready();vi.mocked(f.gateway.validate).mockImplementation(async()=>({...f.evidence(),risk:true}));await f.service.reconcile('FWS-SYNTHETIC',admin);expect(f.state().attempts[0].status).toBe('RISK_REVIEW');expect(f.state().booking.status).toBe('PENDING');});
it('SIMULATED delayed negative cannot downgrade existing captured success',async()=>{const f=await ready();await f.service.reconcile('FWS-SYNTHETIC',admin);const paid=f.state().attempts[0];expect(settle(paid,f.state().booking,{...f.evidence(),status:'FAILED'},now)).toEqual(paid);expect(f.state().captures).toBe(1);expect(f.state().booking.status).toBe('PENDING');});
it('SIMULATED ownership and reconcile authorization preserve ledger',async()=>{const f=await ready(),before=structuredClone(f.state());await expect(f.service.list('FWS-SYNTHETIC',{id:'other',role:'CUSTOMER'})).rejects.toThrow();await expect(f.service.reconcile('FWS-SYNTHETIC',owner)).rejects.toThrow();await expect(f.service.initiate('FWS-SYNTHETIC',{id:'staff',role:'STAFF'},billing)).rejects.toThrow();expect(f.state()).toEqual(before);});
it('SIMULATED expired quote prevents dispatch',()=>{expect(()=>payable(booking(),owner,now+172800000)).toThrow();});

