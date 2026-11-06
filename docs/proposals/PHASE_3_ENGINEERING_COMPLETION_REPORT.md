# FlyWithSafe Phase 3 Engineering Completion

**৫ নভেম্বর ২০২৬ · Engineering PASS · মূল Phase 3 acceptance BLOCKED · Phase 4 ON HOLD · Production payments BLOCKED**

পর্যালোচিত সীমা হলো SSLCommerz sandbox integration ও V4 negative-payment contract। Phase 1 local G7, Phase 2-এর 14/14 এবং local database rename-এর acceptance বহাল আছে। [Phase 1 evidence](PHASE_1_EVIDENCE_LOG.md) · [Phase 2 acceptance ও rename closure](PHASE_2_ACCEPTANCE_REPORT.md)

## Financial boundary review

`fail_url`, `cancel_url` ও IPN নির্দিষ্ট payment attempt-এ সীমাবদ্ধ notification হিসেবে জমা হয়। Signature দেওয়া থাকলে তা যাচাই হয় এবং merchant/store ID দেওয়া থাকলে তা মেলানো হয়। Browser return verification view-তে যায়। Callback-এর দাবি দিয়ে capture বা terminal negative state নির্ধারণ করা যায় না। Server-side authenticated Transaction Query থেকে exact transaction ID, amount ও currency মেলার পরেই negative outcome স্থায়ী হয়। Verified capture-এর জন্য পৃথক Order Validation এবং validation/bank identity ও risk checks প্রযোজ্য। `PROCESSING` ও অজানা status parser-এ fail closed হয়। অসম্পূর্ণ বা পরস্পরবিরোধী evidence reconciliation-এ থাকে। নতুন notice এলে পুরোনো in-flight negative result defer হয়। বিলম্বিত negative notice verified capture downgrade করতে পারে না। Payment settlement থেকে supplier fulfillment হয় না। [Routes](../../server/src/payments/payment.routes.ts) · [Service](../../server/src/payments/payment.service.ts) · [State transitions](../../server/src/payments/payment-domain.ts) · [SSLCommerz adapter](../../server/src/payments/sslcommerz.ts)

V4 callback ও IPN documentation-এ `FAILED` এবং `CANCELLED` আছে। প্রকাশিত Transaction Query status table-এ `FAILED` আছে এবং `CANCELLED` অনুল্লিখিত। Compatible synthetic response দিয়ে cancellation adjudication যাচাই হয়েছে। প্রকৃত cancellation-এর authoritative response ও তার আচরণ provider UAT-তে নিশ্চিত করতে হবে। [V4 integration](https://developer.sslcommerz.com/doc/v4/) · [V4 IPN](https://sandbox-gw.sslcommerz.com/doc/v4/ipn.html) · [V4 Transaction Query](https://sandbox-gw.sslcommerz.com/doc/v4/order-query.html)

## মূল দশটি acceptance gate

| Gate | Engineering evidence | মূল acceptance status |
|---|---|---|
| 1. Public HTTPS, TLS ও exact callback boundary | **PASS**। Synthetic public transport 7/7, সঙ্গে genuine SUCCESS return ও IPN। | **PASS**, পরীক্ষিত sandbox scope। |
| 2. Isolated runtime ও restricted DB | **PASS**। Local DB OID `34701`, restricted role, ৮ migrations এবং retained ownership guards। | **PASS**, পরীক্ষিত isolated scope। ভবিষ্যৎ execution-এ একই preflight বাধ্যতামূলক। |
| 3. Genuine Hosted Checkout outcomes | **PASS**। Genuine SUCCESS ও local contract-এ দুই negative branch। | **BLOCKED**। Genuine FAILED ও CANCELLED উভয়ই pending। |
| 4. Browser returns ও IPN | **PASS**। SUCCESS-এর genuine return ও signed IPN। Local negative return, signed notice ও signature tampering checks PASS। | **BLOCKED**। দুই genuine negative return এবং provider পাঠালে signed IPN evidence বাকি। |
| 5. Authoritative matching ও risk | **PASS**। SUCCESS Order Validation, transaction/amount/currency ও risk যাচাই। Local negative authority, store/identity mismatch এবং unresolved states যাচাই। | **BLOCKED**। দুই negative case-এ provider-এর authoritative matching বাকি। |
| 6. Authenticity, replay, idempotency ও concurrency | **PASS**। Saved 64/64 PostgreSQL, 28/28 mocked contract এবং 32/32 negative PostgreSQL checks-এর প্রযোজ্য evidence। | **BLOCKED**। Genuine negative results-এর সঙ্গে scoped replay ও conflict adjudication বাকি। |
| 7. Persistence, ownership ও role consistency | **PASS**। 79 browser checkpoints। Negative PostgreSQL-এ FAILED ও CANCELLED uncaptured persisted, role views consistent, foreign access denied। | **BLOCKED**। Genuine negative outcome-এর persistence এবং customer/staff/admin consistency বাকি। |
| 8. PAID বনাম FULFILLED | **PASS**। Genuine SUCCESS-এর booking `PENDING`। Negative integration-এর তিন case-এ fulfillment হয়নি। | **PASS**, invariant প্রমাণিত। Genuine negative batch-এ আবার যাচাই করতে হবে। |
| 9. Targeted regression ও protected reconciliation | **PASS**। Read-only reconciliation ও negative PostgreSQL preservation। Atomic rollback verified। | **BLOCKED**। Genuine negative execution-এর পর targeted checks ও protected reconciliation বাকি। |
| 10. Formal acceptance | **Engineering PASS**। বর্তমান evidence সিল করা হয়েছে। | **BLOCKED**। Mandatory provider UAT পূর্ণ হলে দশটি gate পর্যালোচনা করে মূল acceptance দেওয়া যাবে। |

## Execution evidence ও preservation

- Real Express routes, PaymentService, Prisma ও restricted local PostgreSQL দিয়ে negative integration-এ **32/32 PASS, exit 0**। SSLCommerz transport mocked ছিল। তিন synthetic payment-এর event counts 7/3/1। Real PostgreSQL constraint `23514`-এর পর payment status ও event দুটিই rollback হয়েছে। ৩ booking ও ৩ payment insert, ১৩ callback, ৫৭ store transaction, ১৭ event insert attempt, ২৮ payment save attempt এবং ৮ mock query approved caps-এর মধ্যে ছিল। Provider network calls এবং public connections দুটোই শূন্য। [Saved result](../../output/phase3/negative-postgres-20261105-01/result.json) · [Caller exit](../../output/phase3/negative-postgres-20261105-01/caller-result.json) · [Journal](../../output/phase3/negative-postgres-20261105-01/journal.jsonl)
- Genuine SUCCESS `VERIFIED` ও captured। Signed IPN, real browser return এবং authoritative validation-এর evidence retained। পরের FAIL stage timeout এবং CANCEL unexecuted। আগে দেখা `PROCESSING` intent unresolved ও uncaptured। Final read-only reconciliation exit 0-তে ২৩টি পুরোনো owned row, protected snapshot এবং দুই controlled rollback নিশ্চিত। Negative PostgreSQL run-ও preservation PASS করেছে। [Genuine batch result](../../output/phase3/genuine-sandbox-e2e-20261104-02/result.json) · [Read-only reconciliation](../../output/phase3/final-local-reconciliation-20261104-01/result.json)
- Review-এ approved caller hash, ৯৭৭ package pin, ১০২ inventoried historical artifact এবং journal/result-এর ৩২ check মিলেছে। ২২টি evidence file-এর SHA-256 seal রাখা হয়েছে। 28/28 mocked contract run-এর ফল পূর্বের execution record থেকে এসেছে। এই closure review-এ test, provider, database বা tunnel execution হয়নি। [Evidence seal](../../output/phase3/engineering-closure-20261105/evidence-seal.json) · [Saved contract test record](PHASE_3_FINAL_GATES.md#2026-11-05-production-parity-negative-contract-and-genuine-uat)

## Phase-transition policy প্রস্তাব · অনুমোদনের অপেক্ষায়

বর্তমান Phase 4 hold বহাল। মালিক আলাদা করে অনুমোদন দিলে engineering completion-কে **শুধু independently testable Phase 4 local/synthetic development** শুরু করার শর্ত হিসেবে গ্রহণ করা হবে। Phase 4 কাজ mock বা synthetic data-তে সীমিত থাকবে এবং Phase 3 UAT, supplier connectivity ও funds movement থেকে বিচ্ছিন্ন থাকবে। Phase 4-এর implementation scope আলাদাভাবে নির্দিষ্ট করতে হবে। এই পরিবর্তন শুধু কাজের sequencing-এ প্রযোজ্য। মূল Phase 3 formal acceptance-এর দশটি gate, genuine provider UAT এবং release approvals বহাল থাকবে।

Production gateway disabled ও activation **BLOCKED**। Mandatory provider UAT এবং formal Phase 3 acceptance-এর পরও production activation, deployment, live funds বা customer data, supplier calls, cloud migrations ও mutations-এর জন্য প্রযোজ্য আলাদা অনুমোদন প্রয়োজন। Gate B/C, privacy, KMS, retention এবং supplier obligations নিজ নিজ release scope-এ বহাল। [Mandatory provider UAT register](PHASE_3_MANDATORY_PROVIDER_UAT_REGISTER.md)
