'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { ApiError } from '@/lib/api/client';
import { createBookingAttempt, isTerminalBookingFailure } from '@/lib/api/booking-attempt';
import { changeBookingCommercial, type BookingCommercial, type CommercialInput } from '@/lib/api/booking-commercial';
import { GatewayPaymentPanel } from './GatewayPaymentPanel';

export function BookingCommercialPanel({ reference, currency, initial, staff = false, onChanged }: {
  reference: string; currency: string; initial?: BookingCommercial; staff?: boolean; onChanged?: () => void;
}) {
  const [state, setState] = useState<BookingCommercial>(initial || { version: 1, revision: 0, quotes: [], payments: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [action, setAction] = useState<'OFFER_QUOTE' | 'RECORD_PAYMENT'>('OFFER_QUOTE');
  const [method, setMethod] = useState<'BANK_TRANSFER' | 'CASH' | 'MOBILE_BANKING'>('BANK_TRANSFER');
  const [observedNow, setObservedNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setObservedNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 30000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, []);
  const attempt = useRef(createBookingAttempt());
  const latest = state.quotes.at(-1);
  async function submit(command: CommercialInput) {
    setBusy(true); setError('');
    try {
      const result = await changeBookingCommercial(reference, staff ? 'admin' : 'account', command);
      setState(result.booking.commercial); onChanged?.(); return true;
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status >= 400 && cause.status < 500 ? cause.message : 'Request could not be confirmed. Retry the same request.');
      return isTerminalBookingFailure(cause);
    } finally { setBusy(false); }
  }
  return <section className="mt-4 space-y-3 border-t border-neutral-200 pt-4 text-sm" aria-busy={busy}>
    <h4 className="font-bold text-neutral-900">Quotations &amp; payment records</h4>
    <p className="text-xs text-neutral-500">Manual agency workflow. Quotation acceptance does not reserve inventory or charge a payment.</p>
    {state.quotes.map(q => <div key={q.id} className="rounded-xs border border-neutral-200 p-3">
      <p className="font-semibold">{q.amount.toLocaleString()} {q.currency} · {q.acceptedAt ? 'Accepted' : latest?.id !== q.id ? 'Superseded' : observedNow !== null && +new Date(q.validUntil) <= observedNow ? 'Expired' : 'Offered'}</p>
      {q.description && <p className="whitespace-pre-wrap text-xs">{q.description}</p>}
      <p className="text-xs text-neutral-500">Valid until {new Date(q.validUntil).toLocaleString()}</p>
      <p className="text-xs text-neutral-500">Issued {new Date(q.createdAt).toLocaleString()}{q.acceptedAt ? ` · Accepted ${new Date(q.acceptedAt).toLocaleString()}` : ''}</p>
      {!staff && latest?.id === q.id && !q.acceptedAt && <Button size="sm" variant="outline" disabled={busy || (observedNow !== null && +new Date(q.validUntil) <= observedNow)} onClick={async () => {
        const ticket = attempt.current.begin(); if (!ticket) return;
        ticket.settle(await submit({ action: 'ACCEPT_QUOTE', quoteId: q.id, requestId: ticket.requestId, expectedRevision: state.revision }));
      }}>Accept quotation</Button>}
    </div>)}
    {!state.quotes.length && <p className="text-xs text-neutral-500">No quotation issued yet.</p>}
    {state.payments.map(p => <p key={p.id} className="rounded-xs bg-neutral-50 p-2 text-xs">{p.amount.toLocaleString()} {p.currency} · {p.method.replaceAll('_', ' ')} · {p.reference ? `Reference ${p.reference} · ` : ''}Recorded, not verified · {new Date(p.recordedAt).toLocaleString()}</p>)}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {onChanged && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onChanged}>Refresh records</Button>}
    {staff && <form onChange={() => attempt.current.invalidate()} onSubmit={async e => {
      e.preventDefault(); const form = new FormData(e.currentTarget);
      const date = new Date(String(form.get('validUntil')));
      if (action === 'OFFER_QUOTE' && !Number.isFinite(+date)) { setError('A quotation expiry is required.'); return; }
      const ticket = attempt.current.begin(); if (!ticket) return;
      const base = { requestId: ticket.requestId, expectedRevision: state.revision, amount: Number(form.get('amount')), currency };
      const command: CommercialInput = action === 'OFFER_QUOTE'
        ? { ...base, action, validUntil: date.toISOString(), ...(String(form.get('description') || '').trim() ? { description: String(form.get('description')).trim() } : {}) }
        : { ...base, action: 'RECORD_PAYMENT', method, quoteId: state.quotes.find(q => q.acceptedAt)?.id,
          ...(String(form.get('reference') || '').trim() ? { reference: String(form.get('reference')).trim() } : {}) };
      ticket.settle(await submit(command));
    }}>
      <fieldset disabled={busy} className="space-y-2">
        <label className="block text-xs">Action<select name="action" value={action} onChange={e => setAction(e.target.value as typeof action)} className="block w-full rounded-xs border p-2"><option value="OFFER_QUOTE">Issue / revise quotation</option><option value="RECORD_PAYMENT">Record offline payment (unverified)</option></select></label>
        <label className="block text-xs">Amount ({currency}, whole units)<input name="amount" type="number" min="1" max="2000000000" step="1" required className="block w-full rounded-xs border p-2" /></label>
        {action === 'OFFER_QUOTE' ? <>
          <label className="block text-xs">Quotation details (no personal documents)<textarea name="description" maxLength={500} className="block w-full rounded-xs border p-2" /></label>
          <label className="block text-xs">Quotation expiry<input name="validUntil" type="datetime-local" required className="block w-full rounded-xs border p-2" /></label>
        </> : <>
          <label className="block text-xs">Payment method<select name="method" value={method} onChange={e => setMethod(e.target.value as typeof method)} className="block w-full rounded-xs border p-2"><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash</option><option value="MOBILE_BANKING">Mobile banking</option></select></label>
          <label className="block text-xs">Agency receipt reference (no card/account numbers)<input name="reference" required={method !== 'CASH'} pattern="[A-Za-z][A-Za-z0-9/_-]{2,63}" maxLength={64} placeholder="SYN-PAY-001" className="block w-full rounded-xs border p-2" /></label>
        </>}
        <Button type="submit" size="sm" variant="outline">{busy ? 'Saving…' : 'Save record'}</Button>
      </fieldset>
    </form>}
    <GatewayPaymentPanel reference={reference} staff={staff} />
  </section>;
}
