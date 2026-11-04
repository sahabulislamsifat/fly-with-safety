# Phase 4 supplier research — no API execution or production changes

Reviewed 2026-11-04. Research only; provider entitlement, regional availability, commercial terms and owner authorization must precede API access. No inventory retrieved or fabricated.

Candidates:
- Flights: Duffel Flights official offer-search, offer retrieval/repricing and order API. Live account activation and applicable airline access must be established. [Getting started](https://duffel.com/docs/guides/getting-started-with-flights), [activation](https://duffel.com/guides/getting-started).
- Hotels: Duffel Stays requires requested access; search → rates → fresh quote → booking. [Official Stays guide](https://duffel.com/docs/guides/getting-started-with-stays).
- Alternative lodging: Expedia Rapid through approved partner onboarding, not scraped consumer inventory. [Partner onboarding](https://partner.expediagroup.com/en-au/join-us/rapid-api), [developer hub](https://developers.expediagroup.com/docs).

Important: provider sandbox responses are not genuine saleable inventory. In particular Duffel test-mode schedules/prices may not be realistic ([official test-mode documentation](https://duffel.com/docs/api/overview/test-mode)). Only authorized live supplier responses may be represented as real availability, with provider offer/rate IDs, currency, expiry, terms and retrieval timestamp. No live search or purchase is approved here.

Proposed adapter contract: search, reprice, reserve/order, retrieve, cancel/refund capabilities. Preserve provider IDs and raw evidence privately under retention controls, normalize public offers without inventing availability. Persist supplier-operation idempotency and distinguish pending, confirmed, failed and unknown outcomes. Unknown purchase outcome requires retrieve/reconciliation before retry, never blind rebooking. Payment capture and supplier fulfillment are separate state machines; price/availability revalidation and explicit compensation policy are required. No supplier booking is automatically issued by a payment callback.

Next research gate: choose contracted supplier and verify country/business eligibility, live inventory entitlement, support/refund responsibilities and permitted test environment. Implementation remains separate from Phase 3 acceptance.
