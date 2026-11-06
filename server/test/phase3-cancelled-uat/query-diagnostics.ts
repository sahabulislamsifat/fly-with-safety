import type { Gateway, GatewayConfig } from '../../src/payments/sslcommerz.js';
import { classifyBody } from '../phase3-query-observation/observe.js';
import { LimitedGateway, type Scope } from './scope.js';

export class CancelledGateway extends LimitedGateway {
  constructor(inner: Gateway, scope: Scope, private readonly stopRun: (code: string) => void) {
    super(inner, scope, () => stopRun('QUERY_CONFLICT_OR_MISMATCH'));
  }
  override async query(tranId: string) {
    const hadCancelled = this.cancelledEvidenceSeen;
    try {
      const rows = await super.query(tranId);
      if (hadCancelled && rows[0]?.status !== 'CANCELLED') throw Error('CANCELLED_QUERY_REGRESSION');
      return rows;
    } catch (error) {
      if (hadCancelled) this.stopRun('CANCELLED_AUTHORITY_NO_LONGER_CONFIRMED');
      throw error;
    }
  }
}

/** Observes a bounded copy of the same response. Only the SDK can emit Evidence. */
export function queryDiagnostics(config: GatewayConfig, scope: Pick<Scope, 'payments'>, record: (event: object) => void, transport: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname !== '/validator/api/merchantTransIDvalidationAPI.php') return transport(input, init);
    const owned = [...scope.payments.values()].find(p => p.tranId === url.searchParams.get('tran_id'));
    if (url.origin !== 'https://sandbox.sslcommerz.com' || init?.method !== 'GET' || init.redirect !== 'error' || !owned || url.searchParams.get('store_id') !== config.storeId || url.searchParams.get('store_passwd') !== config.password) throw Error('QUERY_TRANSPORT_SCOPE');
    const log = (detail: object) => record({ kind: 'query-diagnostic', ...detail });
    let response: Response;
    try { response = await transport(input, init); }
    catch (error) { log({ stage: 'HTTP_TRANSPORT' }); throw error; }
    if (!response.ok) { log({ stage: 'HTTP_STATUS', httpStatus: response.status }); return response; }
    const reader = response.clone().body?.getReader();
    if (!reader) { log({ stage: 'RESPONSE_SHAPE', issue: 'NO_BODY' }); return response; }
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > 131072) { log({ stage: 'RESPONSE_SHAPE', issue: 'BODY_LIMIT' }); void reader.cancel().catch(() => {}); return response; }
        chunks.push(chunk.value);
      }
      const bytes = Buffer.concat(chunks);
      const detail = classifyBody(bytes, { tranId: owned.tranId, amountMinor: String(owned.fixture.amount * 100), currency: 'BDT' }, config.storeId);
      let rows: Array<{store_id?: unknown; status?: unknown} | null> = [];
      try { const parsed = JSON.parse(bytes.toString('utf8')); if (Array.isArray(parsed?.element)) rows = parsed.element.slice(0, 20); } catch { /* classifier records invalid JSON */ }
      log({ stage: 'RESPONSE_CLASSIFIED', httpStatus: response.status, ...detail,
        rowIdentity: rows.map(row => ({ storeEchoMatches: row?.store_id === undefined ? null : row.store_id === config.storeId,
          processing: row?.status === 'PROCESSING' })) });
    } catch { log({ stage: 'RESPONSE_READ_ERROR' }); }
    return response;
  };
}
