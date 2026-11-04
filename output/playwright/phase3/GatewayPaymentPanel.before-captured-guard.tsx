'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api/client';
import { Button } from '@/components/ui';
import { createLatestRequestScope } from '@/lib/api/latest-request';

type Payment = { id: string; mode: 'sandbox'; status: string; financialState: string; amountMinor: string; currency: string; captured: boolean; fulfillment: string; updatedAt: string };
type Records = { payments: Payment[]; refunds: { id: string; paymentId: string; amountMinor: string; status: string }[]; history: { kind: string; createdAt: string }[]; refundsEnabled: boolean };
function money(minor: string) { const n = BigInt(minor), base = BigInt(100); return `${n / base}.${String(n % base).padStart(2, '0')} BDT`; }
export function GatewayPaymentPanel({ reference, staff }: { reference: string; staff: boolean }) {
  const [enabled, setEnabled] = useState(false), [records, setRecords] = useState<Records | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [loadedReference, setLoadedReference] = useState<string | null>(null);
  const request = useRef<string | null>(null);
  const reads = useRef(createLatestRequestScope());
  const path = `/payments/bookings/${encodeURIComponent(reference)}`;
  const refresh = useCallback(async () => {
    const current = reads.current.begin(), data = await apiRequest<Records>(path);
    if (current()) { setRecords(data); setLoadedReference(reference); }
  }, [path, reference]);
  useEffect(() => {
    let alive = true;
    void apiRequest<{ enabled: boolean }>('/payments/capabilities').then(async c => {
      if (!c.enabled || !alive) return;
      const data = await apiRequest<Records>(path);
      if (alive) { setEnabled(true); setRecords(data); setLoadedReference(reference); }
    }).catch(() => { /* Disabled/unavailable payment controls must not disrupt the existing manual workflow. */ });
    const scope = reads.current;
    return () => { alive = false; scope.cancel(); };
  }, [path, reference]);
  useEffect(() => {
    if (!enabled) return;
    let count = 0;
    const timer = window.setInterval(() => { if (++count > 20) { window.clearInterval(timer); return; } void refresh().catch(() => {}); }, 15000);
    return () => window.clearInterval(timer);
  }, [enabled, refresh]);
  if (!enabled || loadedReference !== reference) return null;
  return <section className="mt-4 space-y-3 border-t border-neutral-200 pt-4 text-sm" aria-busy={busy}>
    <h4 className="font-bold">SSLCommerz sandbox payments</h4>
    <p className="text-xs text-neutral-500">Synthetic testing only. Payment verification does not issue tickets or confirm supplier inventory. Manual records remain unverified.</p>
    {records?.payments.map(p => <div key={p.id} className="rounded-xs border border-neutral-200 p-3">
      <p className="font-semibold">{money(p.amountMinor)} · {p.financialState.replaceAll('_', ' ')}</p>
      <p className="text-xs">{p.fulfillment.replaceAll('_', ' ')} · Updated {new Date(p.updatedAt).toLocaleString()}</p>
    </div>)}
    {records?.refunds.map(r => <p className="text-xs" key={r.id}>Refund {money(r.amountMinor)} · {r.status}. An initiated refund is not a completed refund.</p>)}
    {!!records?.history.length && <details className="text-xs"><summary>Payment audit history</summary><ol>{records.history.map((e, i) => <li key={`${e.createdAt}:${i}`}>{e.kind.replaceAll('_', ' ')} · {new Date(e.createdAt).toLocaleString()}</li>)}</ol></details>}
    <Button size="sm" variant="outline" disabled={busy} onClick={() => void refresh().catch(() => setMessage('Payment status could not be refreshed.'))}>Refresh payment status</Button>
    {!staff && <form onChange={() => { request.current = null; }} onSubmit={async e => {
      e.preventDefault(); if (busy) return; setBusy(true); setMessage('');
      const form = new FormData(e.currentTarget);
      request.current ||= crypto.randomUUID();
      try {
        const result = await apiRequest<{ payment: Payment; checkoutUrl?: string }>(`${path}/initiate`, { method: 'POST', headers: { 'Idempotency-Key': request.current }, body: JSON.stringify({ requestId: request.current, address: String(form.get('address')), city: String(form.get('city')), country: String(form.get('country')) }) });
        if (result.checkoutUrl) {
          const url = new URL(result.checkoutUrl);
          if (url.origin !== 'https://sandbox.sslcommerz.com' || url.username || url.password || url.hash) throw Error();
          window.location.assign(url.href);
        } else { setMessage('Payment outcome is pending. Refresh status; do not create another charge.'); await refresh(); }
      } catch { setMessage('Checkout could not be confirmed. Retry with the same billing details or refresh payment status.'); }
      finally { setBusy(false); }
    }}>
      <fieldset disabled={busy} className="space-y-2">
        <label className="block text-xs">Synthetic billing address<input name="address" required maxLength={100} className="block w-full rounded-xs border p-2" /></label>
        <label className="block text-xs">City<input name="city" required maxLength={50} className="block w-full rounded-xs border p-2" /></label>
        <label className="block text-xs">Country code<input name="country" required pattern="[A-Z]{2}" maxLength={2} placeholder="BD" className="block w-full rounded-xs border p-2" /></label>
        <Button size="sm" variant="outline" type="submit">{busy ? 'Checking…' : 'Pay now / resume sandbox checkout'}</Button>
      </fieldset>
    </form>}
    {staff && <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
      setBusy(true); setMessage(''); try { await apiRequest(`${path}/reconcile`, { method: 'POST', body: '{}' }); await refresh(); } catch { setMessage('Gateway recheck remains unresolved.'); } finally { setBusy(false); }
    }}>Reconcile with gateway</Button>}
    {staff && records?.refundsEnabled && <form onSubmit={async e => {
      e.preventDefault(); if (busy) return; setBusy(true); setMessage('');
      const data = new FormData(e.currentTarget); request.current ||= crypto.randomUUID();
      try { await apiRequest(`${path}/refunds`, { method: 'POST', headers: { 'Idempotency-Key': request.current }, body: JSON.stringify({ requestId: request.current, paymentId: data.get('paymentId'), amountMinor: data.get('amountMinor'), reason: data.get('reason') }) }); await refresh(); }
      catch { setMessage('Refund outcome could not be confirmed. Preserve the request; do not submit another refund.'); }
      finally { setBusy(false); }
    }} onChange={() => { request.current = null; }}>
      <fieldset disabled={busy} className="space-y-2">
        <label className="block text-xs">Verified payment<select name="paymentId" required className="block w-full border p-2">{records.payments.filter(p => p.captured).map(p => <option key={p.id} value={p.id}>{p.id} · {money(p.amountMinor)}</option>)}</select></label>
        <label className="block text-xs">Refund amount (integer paisa)<input name="amountMinor" required inputMode="numeric" pattern="[0-9]{1,10}" className="block w-full border p-2" /></label>
        <label className="block text-xs">Reason (no personal or card data)<input name="reason" required maxLength={100} className="block w-full border p-2" /></label>
        <Button type="submit" size="sm" variant="outline">Request sandbox refund</Button>
      </fieldset>
    </form>}
    {message && <p role="status" className="text-xs text-neutral-700">{message}</p>}
  </section>;
}

/** Reuses the existing operations dashboard; no new navigation surface or automatic provider request. */
export function GatewayOperationsQueue() {
  type Entry = { reference: string; paymentId: string; status: string; refundPending: boolean };
  const [entries, setEntries] = useState<Entry[] | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    void apiRequest<{ enabled: boolean }>('/payments/capabilities').then(async c => {
      if (!c.enabled || !alive) return;
      const data = await apiRequest<{ entries: Entry[] }>('/payments/operations');
      if (alive) setEntries(data.entries);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (entries === null) return null;
  return <section className="space-y-3 rounded-xs border border-neutral-200 bg-white p-4 text-sm" aria-busy={busy}>
    <h3 className="font-bold">Sandbox payment operations</h3>
    <p className="text-xs text-neutral-500">At most 50 pending/review entries. No payment outcome or supplier fulfillment is inferred from this queue.</p>
    {entries.length === 0 && <p className="text-xs">No pending payment operations.</p>}
    <ul className="space-y-2">{entries.map(e => <li key={e.paymentId} className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2">
      <span>{e.reference} · {e.status.replaceAll('_', ' ')}{e.refundPending ? ' · Refund pending/review' : ''}</span>
      <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try { await apiRequest(`/payments/bookings/${encodeURIComponent(e.reference)}/reconcile`, { method: 'POST', body: '{}' }); setEntries((await apiRequest<{ entries: Entry[] }>('/payments/operations')).entries); }
        catch { setError('Gateway reconciliation could not be confirmed. Preserve the existing payment.'); }
        finally { setBusy(false); }
      }}>Recheck</Button>
    </li>)}</ul>
    {error && <p role="status" className="text-xs text-red-700">{error}</p>}
  </section>;
}
