# ATK Runtime Foundation

This directory contains the first runtime-side primitives for ARHIAX Nauta.

Current scope:

- Resolve OPA package results into an ATK outcome using contractual precedence.
- Keep audit records as side effects even when the primary outcome is `PERMIT`, `DENY`, `ESCALATE`, or `SUSPEND`.

The runtime does not yet expose `/evaluate`. That endpoint will wrap:

1. HMAC ledger pre-attestation.
2. Optional FHIR validation.
3. OPA evaluation.
4. Outcome resolution via `runtime/atk/outcome.mjs`.
5. Structured audit/metrics emission.
