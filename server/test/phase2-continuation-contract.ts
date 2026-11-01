import { z } from 'zod';
import { safeFailure } from './phase2-identity-diagnostic.js';
const id = z.string().regex(/^c[a-z0-9]{20,63}$/);
const actor = z.object({ id: z.uuid(), email: z.email(), role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN']) }).strict();
const linked = z.object({ id, bookingId: id }).strict();
const schema = z.object({
  actors: z.array(actor).length(4),
  sessions: z.array(z.object({ id, userId: z.uuid() }).strict()).length(4),
  booking: z.object({ id, reference: z.string().regex(/^FWS-\d{4}-[A-Z0-9]{6}$/), userId: z.uuid(), requestId: z.uuid() }).strict(),
  passenger: linked, history: linked,
  idempotency: z.object({ id, referenceNumber: z.string() }).strict(), notification: z.object({ id }).strict(),
}).strict();
export function retainedContract(value: unknown) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error('PHASE2_RETAINED_CONTRACT_INVALID');
  const c = parsed.data;
  const roles = ['CUSTOMER', 'CUSTOMER', 'STAFF', 'ADMIN'];
  if (new Set(c.actors.map(a => a.id)).size !== 4 || new Set(c.sessions.map(s => s.id)).size !== 4 ||
      c.actors.some((a, index) => a.role !== roles[index] || a.email !== a.id + '@example.invalid' || c.sessions.filter(s => s.userId === a.id).length !== 1) ||
      c.booking.userId !== c.actors[0].id || c.passenger.bookingId !== c.booking.id || c.history.bookingId !== c.booking.id ||
      c.idempotency.referenceNumber !== c.booking.reference)
    throw new Error('PHASE2_RETAINED_LINKAGE_INVALID');
  return c;
}
export type RetainedContract = ReturnType<typeof retainedContract>;
export function assertDispatchBudget(elapsedMs: number) {
  // Leave the original 10s HTTP deadline and a 5s database observation window inside the 60s case.
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs >= 45000) throw new Error('PHASE2_CONTINUATION_DISPATCH_BUDGET_STOP');
}
export function traceActualService<Args extends unknown[], Result>(operation: (...args: Args) => Promise<Result>, record: (failure: ReturnType<typeof safeFailure>) => void) {
  return async (...args: Args): Promise<Result> => {
    try { return await operation(...args); }
    catch (error) { record(safeFailure(error)); throw error; }
  };
}
export function trackActualTask<Args extends unknown[], Result>(operation: (...args: Args) => Promise<Result>, pending: Set<Promise<unknown>>, failures: ReturnType<typeof safeFailure>[]) {
  return (...args: Args): Promise<Result> => {
    const task = operation(...args);
    pending.add(task);
    void task.then(() => { pending.delete(task); }, error => { pending.delete(task); failures.push(safeFailure(error)); });
    return task;
  };
}
