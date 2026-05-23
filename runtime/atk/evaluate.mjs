import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { resolveOutcome } from "./outcome.mjs";

export function evaluatePolicyResult(policyResult, options = {}) {
  const startedAt = options.startedAt ?? performance.now();
  const decision = resolveOutcome(policyResult);
  const finishedAt = options.finishedAt ?? performance.now();

  return {
    evaluation_id: options.evaluationId ?? randomUUID(),
    outcome: decision.outcome,
    reasons: decision.reasons,
    effects: decision.effects,
    latency_ms: Number((finishedAt - startedAt).toFixed(3)),
    policy_result: policyResult,
  };
}

export function mapEvaluationError(error, evaluationId = randomUUID()) {
  const message = error instanceof Error ? error.message : String(error);

  return {
    evaluation_id: evaluationId,
    outcome: "DENY",
    reasons: [
      {
        source: "runtime",
        message: `DENY · RUNTIME-FAIL-CLOSED: ${message}`,
      },
    ],
    effects: {
      audit: [],
    },
    latency_ms: 0,
    policy_result: {},
  };
}
