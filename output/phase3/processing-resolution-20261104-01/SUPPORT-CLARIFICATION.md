# Required provider clarification (no credentials or identifiers)

1. Transaction Query returned APIConnect DONE and exact status PROCESSING for an incomplete sandbox checkout. Is this an official nonterminal state? What authoritative query/IPN transition resolves it, and can fresh independent sandbox cases proceed while this old intent remains PROCESSING?
2. What supported sandbox checkout action deterministically yields FAILED (issuer decline), and what exact action yields CANCELLED? Please specify Hosted/Easy Checkout differences and prerequisites if PAY is disabled. We will not assume popup X or browser close is cancellation or use invented test-card data.
3. For each negative outcome, what return method/status, IPN delivery expectation and Transaction Query/Order Validation status should integration tests require?

No transaction identifiers, session URLs, credentials, OTPs or real customer information are needed in the project evidence copy. No support message was sent by the agent.
